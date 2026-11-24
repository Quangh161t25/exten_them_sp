/**
 * Table Column Customizer for Shopee Tool
 * Hỗ trợ kéo thả sắp xếp cột, ẩn hiện cột, căn lề, xuống dòng, độ rộng, cố định cột (freeze/sticky).
 */

const STORAGE_PREFIX = 'shopee_table_cols_v1_';

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

    if (!defaultCols || !defaultCols.length) {
      return saved.map((s, idx) => ({
        id: s.id || `col_${idx}`,
        label: s.label || `Cột ${idx + 1}`,
        visible: s.visible !== false,
        align: s.align || 'left',
        wrap: !!s.wrap,
        width: s.width !== undefined ? Number(s.width) : 0,
        fixed: !!s.fixed,
        isParent: s.isParent ?? true
      }));
    }

    const savedMap = new Map(saved.map((c) => [c.id, c]));
    const result = [];
    const usedDefIds = new Set();

    for (const c of saved) {
      const def = defaultCols.find((d) => d.id === c.id);
      if (def && !usedDefIds.has(def.id)) {
        usedDefIds.add(def.id);
        result.push({
          ...def,
          ...c,
          label: def.label || c.label,
          isParent: def.isParent ?? c.isParent,
          visible: c.visible !== undefined ? c.visible : (def.visible ?? true),
          align: c.align || def.align || 'left',
          wrap: c.wrap !== undefined ? c.wrap : (def.wrap ?? false),
          width: c.width !== undefined ? Number(c.width) : (def.width || 0),
          fixed: c.fixed !== undefined ? c.fixed : (def.fixed ?? false)
        });
      } else if (!def && c.id) {
        result.push({
          ...c,
          visible: c.visible !== undefined ? c.visible : true,
          align: c.align || 'left',
          wrap: !!c.wrap,
          width: c.width !== undefined ? Number(c.width) : 0,
          fixed: !!c.fixed
        });
      }
    }

    for (const def of defaultCols) {
      if (!usedDefIds.has(def.id)) {
        result.push({ ...def });
      }
    }
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
  return defaultCols.map((c) => ({
    id: c.id,
    label: c.label,
    isParent: c.isParent ?? true,
    visible: c.visible ?? true,
    align: c.align || c.defaultAlign || 'left',
    wrap: c.wrap ?? c.defaultWrap ?? false,
    width: c.width || c.defaultWidth || 0,
    fixed: c.fixed ?? c.defaultFixed ?? false
  }));
}

/**
 * Sinh dynamic CSS cho bảng dựa trên cấu hình cột (căn lề, độ rộng, xuống dòng, ẩn/hiện, cố định cột)
 */
export function applyTableStyles(tableId, config, skipResizer = false) {
  let styleEl = document.getElementById(`custom-style-${tableId}`);
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = `custom-style-${tableId}`;
    document.head.appendChild(styleEl);
  }

  const tableEl = document.getElementById(tableId);
  const rules = [];
  const activeCols = config.filter((c) => c.visible !== false);
  let cumulativeLeft = 0;
  let lastFixedColId = null;

  rules.push(`#${tableId} { table-layout: fixed !important; min-width: 100% !important; border-collapse: separate !important; border-spacing: 0 !important; }`);

  for (const c of activeCols) {
    const sel = `#${tableId} [data-col="${c.id}"]`;
    const thSel = `#${tableId} th[data-col="${c.id}"]`;
    const tdSel = `#${tableId} td[data-col="${c.id}"]`;

    // 1. Căn lề
    if (c.align) {
      rules.push(`${sel} { text-align: ${c.align} !important; }`);
    }

    // 2. Xuống dòng
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
      rules.push(`${thSel} { position: sticky !important; top: 0 !important; left: ${leftPx}px !important; z-index: 25 !important; background: #f8fafc !important; }`);
      rules.push(`${tdSel} { position: sticky !important; left: ${leftPx}px !important; z-index: 5 !important; background: inherit !important; }`);
      rules.push(`#${tableId} tr.first-model ${tdSel} { background: #fff !important; }`);
      rules.push(`#${tableId} tr.model-row ${tdSel} { background: #fcfcfd !important; }`);
      cumulativeLeft += fixedColWidth;
      lastFixedColId = c.id;
    }
  }

  // Luôn ghim cố định dòng tiêu đề lên đỉnh bảng khi cuộn
  rules.push(`#${tableId} thead th { position: sticky !important; top: 0 !important; z-index: 10; background: #fafafa !important; box-shadow: 0 1px 1px rgba(0,0,0,0.06); }`);

  // Viền bóng nhẹ bên phải cột cố định cuối cùng để phân tách rõ ràng khi cuộn
  if (lastFixedColId) {
    rules.push(`#${tableId} [data-col="${lastFixedColId}"] { border-right: 2px solid #cbd5e1 !important; box-shadow: 2px 0 5px rgba(0,0,0,0.06); }`);
  }

  // Cột bị ẩn
  const hiddenCols = config.filter((c) => c.visible === false);
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
 * Kéo trực tiếp ở tiêu đề cột để thay đổi kích thước
 */
export function attachColumnResizers(tableId, onResizeEnd) {
  const table = typeof tableId === 'string' ? document.getElementById(tableId) : tableId;
  if (!table) return;

  const thead = table.querySelector('thead');
  if (!thead) return;

  const ths = thead.querySelectorAll('th[data-col]');
  ths.forEach((th) => {
    if (th.querySelector('.col-resizer')) return;

    const currentPos = th.style.position || window.getComputedStyle(th).position;
    if (!currentPos || currentPos === 'static') {
      th.style.position = 'relative';
    }

    const resizer = document.createElement('div');
    resizer.className = 'col-resizer';
    resizer.title = 'Kéo chuột để thay đổi độ rộng cột (Nhấp đúp để tự động)';
    resizer.style.cssText = 'position:absolute;top:0;right:0;width:7px;bottom:0;cursor:col-resize;user-select:none;z-index:25;';
    th.appendChild(resizer);

    resizer.addEventListener('dblclick', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const colId = th.getAttribute('data-col');
      if (!colId) return;
      const id = typeof tableId === 'string' ? tableId : table.id;
      const config = getTableConfig(id);
      const targetCol = config.find((c) => c.id === colId);
      if (targetCol) {
        targetCol.width = 0;
        saveTableConfig(id, config);
        applyTableStyles(id, config, false);
        if (typeof onResizeEnd === 'function') onResizeEnd(config);
      }
    });

    resizer.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();

      const colId = th.getAttribute('data-col');
      if (!colId) return;

      const id = typeof tableId === 'string' ? tableId : table.id;
      const startX = e.clientX;
      const startWidth = th.getBoundingClientRect().width;
      let currentWidth = Math.round(startWidth);

      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      resizer.classList.add('is-resizing');

      let guideLine = document.getElementById('table-resize-guideline');
      if (!guideLine) {
        guideLine = document.createElement('div');
        guideLine.id = 'table-resize-guideline';
        guideLine.style.cssText = 'position:fixed;top:0;bottom:0;width:2px;background:#0284c7;box-shadow:0 0 6px rgba(2,132,199,0.7);z-index:9999999;pointer-events:none;display:none;';
        document.body.appendChild(guideLine);
      }
      guideLine.style.left = e.clientX + 'px';
      guideLine.style.display = 'block';

      let config = getTableConfig(id);
      if (!config || !config.length) {
        config = Array.from(ths).map((h, i) => ({
          id: h.getAttribute('data-col') || `col_${i}`,
          label: h.textContent.replace(/⚙️/g, '').trim(),
          visible: true,
          width: Math.round(h.getBoundingClientRect().width)
        }));
      }

      let animFrameId = null;

      const onMouseMove = (moveEvent) => {
        const diffX = moveEvent.clientX - startX;
        currentWidth = Math.max(35, Math.round(startWidth + diffX));
        guideLine.style.left = moveEvent.clientX + 'px';

        if (animFrameId) cancelAnimationFrame(animFrameId);
        animFrameId = requestAnimationFrame(() => {
          let targetCol = config.find((c) => c.id === colId);
          if (targetCol) {
            targetCol.width = currentWidth;
          } else {
            config.push({
              id: colId,
              label: th.textContent.replace(/⚙️/g, '').trim(),
              visible: true,
              width: currentWidth
            });
          }
          applyTableStyles(id, config, true);
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

        let targetCol = config.find((c) => c.id === colId);
        if (targetCol) {
          targetCol.width = currentWidth;
        }
        saveTableConfig(id, config);
        applyTableStyles(id, config, false);

        if (typeof onResizeEnd === 'function') {
          onResizeEnd(config);
        }
      };

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    });
  });
}

export function openColumnCustomizerModal({ tableId, tableName, defaultCols, currentConfig, onSave }) {
  let modal = document.getElementById('tableColCustomizerModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'tableColCustomizerModal';
    modal.className = 'modal hidden';
    document.body.appendChild(modal);
  }

  // Tạo bản sao làm việc tạm thời
  let workingConfig = JSON.parse(JSON.stringify(currentConfig || getTableConfig(tableId, defaultCols)));

  function renderList() {
    const listBody = modal.querySelector('#colConfigList');
    if (!listBody) return;

    listBody.innerHTML = workingConfig.map((col, idx) => `
      <div class="col-item-row" data-idx="${idx}" draggable="true" style="display:flex;align-items:center;gap:10px;padding:8px 10px;border-bottom:1px solid #f1f5f9;background:#fff;border-radius:6px;margin-bottom:4px;user-select:none;transition:background .15s;">
        <div class="col-drag-handle" title="Kéo thả để đổi thứ tự" style="cursor:grab;font-size:16px;color:#94a3b8;padding:0 4px;">⠿</div>
        
        <div style="display:flex;gap:2px;">
          <button type="button" class="btn small btn-move-up" data-idx="${idx}" title="Di chuyển lên" ${idx === 0 ? 'disabled style="opacity:0.3"' : ''} style="padding:2px 6px;font-size:11px;">▲</button>
          <button type="button" class="btn small btn-move-down" data-idx="${idx}" title="Di chuyển xuống" ${idx === workingConfig.length - 1 ? 'disabled style="opacity:0.3"' : ''} style="padding:2px 6px;font-size:11px;">▼</button>
        </div>

        <label style="display:flex;align-items:center;gap:6px;width:170px;margin:0;font-weight:600;font-size:13px;cursor:pointer;">
          <input type="checkbox" class="col-vis-chk" data-idx="${idx}" ${col.visible !== false ? 'checked' : ''}>
          <span title="${col.label}">${col.label}</span>
        </label>

        <!-- Căn lề dạng icon -->
        <div class="col-align-group" title="Căn lề cột" style="display:inline-flex;border:1px solid #cbd5e1;border-radius:6px;overflow:hidden;background:#f8fafc;">
          <button type="button" class="btn-align-icon ${col.align === 'left' ? 'active' : ''}" data-idx="${idx}" data-align="left" title="Căn trái" style="padding:4px 6px;border:none;background:${col.align === 'left' ? '#0284c7' : 'transparent'};color:${col.align === 'left' ? '#ffffff' : '#64748b'};cursor:pointer;display:flex;align-items:center;transition:all .15s;">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="12" x2="15" y2="12"></line><line x1="3" y1="18" x2="18" y2="18"></line></svg>
          </button>
          <button type="button" class="btn-align-icon ${col.align === 'center' ? 'active' : ''}" data-idx="${idx}" data-align="center" title="Căn giữa" style="padding:4px 6px;border:none;border-left:1px solid #cbd5e1;border-right:1px solid #cbd5e1;background:${col.align === 'center' ? '#0284c7' : 'transparent'};color:${col.align === 'center' ? '#ffffff' : '#64748b'};cursor:pointer;display:flex;align-items:center;transition:all .15s;">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="3" y1="6" x2="21" y2="6"></line><line x1="6" y1="12" x2="18" y2="12"></line><line x1="4" y1="18" x2="20" y2="18"></line></svg>
          </button>
          <button type="button" class="btn-align-icon ${col.align === 'right' ? 'active' : ''}" data-idx="${idx}" data-align="right" title="Căn phải" style="padding:4px 6px;border:none;background:${col.align === 'right' ? '#0284c7' : 'transparent'};color:${col.align === 'right' ? '#ffffff' : '#64748b'};cursor:pointer;display:flex;align-items:center;transition:all .15s;">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="3" y1="6" x2="21" y2="6"></line><line x1="9" y1="12" x2="21" y2="12"></line><line x1="6" y1="18" x2="21" y2="18"></line></svg>
          </button>
        </div>

        <!-- Xuống dòng dạng icon -->
        <button type="button" class="btn-wrap-icon ${col.wrap ? 'active' : ''}" data-idx="${idx}" title="${col.wrap ? 'Xuống dòng: BẬT (Bấm để tắt)' : 'Xuống dòng: TẮT (Bấm để bật)'}" style="padding:4px 7px;border-radius:6px;border:1px solid ${col.wrap ? '#0284c7' : '#cbd5e1'};background:${col.wrap ? '#0284c7' : '#f8fafc'};color:${col.wrap ? '#ffffff' : '#64748b'};cursor:pointer;display:inline-flex;align-items:center;justify-content:center;transition:all .15s;">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="6" x2="21" y2="6"></line><path d="M3 12h15a3 3 0 1 1 0 6h-4"></path><polyline points="16 16 14 18 16 20"></polyline><line x1="3" y1="18" x2="10" y2="18"></line></svg>
        </button>

        <!-- Độ rộng px / Tự động -->
        <div style="display:flex;align-items:center;justify-content:center;width:86px;flex:0 0 86px;" title="Độ rộng cột: nhập số px hoặc để trống / gõ 0 để Tự động (nhấp đúp để đặt lại Tự động)">
          <input type="text" inputmode="numeric" class="col-width-input" data-idx="${idx}" value="${col.width && Number(col.width) > 0 ? col.width : ''}" placeholder="Tự động" title="Để trống hoặc gõ 0 để Tự động (nhấp đúp để xoá về Tự động)" style="width:80px;height:25px;padding:2px 6px;font-size:11.5px;border:1px solid #cbd5e1;border-radius:6px;text-align:center;background:#fff;color:#0f172a;outline:none;">
        </div>

        <label style="display:flex;align-items:center;gap:4px;margin:0;font-size:12px;cursor:pointer;" title="Cố định cột đứng yên bên trái khi cuộn ngang">
          <input type="checkbox" class="col-fixed-chk" data-idx="${idx}" ${col.fixed ? 'checked' : ''}>
          <span>📌 Cố định</span>
        </label>
      </div>
    `).join('');

    bindListEvents();
  }

  function bindListEvents() {
    const listBody = modal.querySelector('#colConfigList');
    if (!listBody) return;

    // Visibility toggle
    listBody.querySelectorAll('.col-vis-chk').forEach((chk) => {
      chk.onchange = (e) => {
        const idx = Number(e.target.dataset.idx);
        workingConfig[idx].visible = e.target.checked;
      };
    });

    // Align icon button click
    listBody.querySelectorAll('.btn-align-icon').forEach((btn) => {
      btn.onclick = (e) => {
        const b = e.currentTarget;
        const idx = Number(b.dataset.idx);
        const align = b.dataset.align;
        workingConfig[idx].align = align;
        const group = b.closest('.col-align-group');
        if (group) {
          group.querySelectorAll('.btn-align-icon').forEach((item) => {
            const isActive = item.dataset.align === align;
            item.style.background = isActive ? '#0284c7' : 'transparent';
            item.style.color = isActive ? '#ffffff' : '#64748b';
            if (isActive) item.classList.add('active');
            else item.classList.remove('active');
          });
        }
      };
    });

    // Wrap toggle via icon button
    listBody.querySelectorAll('.btn-wrap-icon').forEach((btn) => {
      btn.onclick = (e) => {
        const b = e.currentTarget;
        const idx = Number(b.dataset.idx);
        const nextWrap = !workingConfig[idx].wrap;
        workingConfig[idx].wrap = nextWrap;
        b.style.background = nextWrap ? '#0284c7' : '#f8fafc';
        b.style.color = nextWrap ? '#ffffff' : '#64748b';
        b.style.borderColor = nextWrap ? '#0284c7' : '#cbd5e1';
        b.title = nextWrap ? 'Xuống dòng: BẬT (Bấm để tắt)' : 'Xuống dòng: TẮT (Bấm để bật)';
        if (nextWrap) b.classList.add('active');
        else b.classList.remove('active');
      };
    });

    // Width input
    listBody.querySelectorAll('.col-width-input').forEach((inp) => {
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

    // Fixed toggle
    listBody.querySelectorAll('.col-fixed-chk').forEach((chk) => {
      chk.onchange = (e) => {
        const idx = Number(e.target.dataset.idx);
        workingConfig[idx].fixed = e.target.checked;
      };
    });

    // Move Up
    listBody.querySelectorAll('.btn-move-up').forEach((btn) => {
      btn.onclick = () => {
        const idx = Number(btn.dataset.idx);
        if (idx > 0) {
          const item = workingConfig.splice(idx, 1)[0];
          workingConfig.splice(idx - 1, 0, item);
          renderList();
        }
      };
    });

    // Move Down
    listBody.querySelectorAll('.btn-move-down').forEach((btn) => {
      btn.onclick = () => {
        const idx = Number(btn.dataset.idx);
        if (idx < workingConfig.length - 1) {
          const item = workingConfig.splice(idx, 1)[0];
          workingConfig.splice(idx + 1, 0, item);
          renderList();
        }
      };
    });

    // Drag and Drop (HTML5)
    let dragIdx = null;
    const rows = listBody.querySelectorAll('.col-item-row');
    rows.forEach((row) => {
      row.addEventListener('dragstart', (e) => {
        dragIdx = Number(row.dataset.idx);
        row.style.opacity = '0.4';
        e.dataTransfer.effectAllowed = 'move';
      });

      row.addEventListener('dragend', () => {
        row.style.opacity = '1';
        rows.forEach((r) => (r.style.background = '#fff'));
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
    <style>
      #tableColCustomizerModal button {
        width: auto !important;
        min-height: 0 !important;
        flex: 0 0 auto !important;
      }
      #tableColCustomizerModal .col-align-group {
        display: inline-flex !important;
        flex: 0 0 auto !important;
        height: 24px !important;
      }
      #tableColCustomizerModal .btn-align-icon {
        width: 25px !important;
        height: 22px !important;
        flex: 0 0 25px !important;
      }
      #tableColCustomizerModal .btn-wrap-icon {
        width: 26px !important;
        height: 24px !important;
        flex: 0 0 26px !important;
      }
      #tableColCustomizerModal .btn-move-up,
      #tableColCustomizerModal .btn-move-down {
        width: 20px !important;
        height: 22px !important;
        flex: 0 0 20px !important;
      }
    </style>
    <div class="modal-box" style="width:min(860px, 96vw);max-height:88vh;display:flex;flex-direction:column;padding:20px;background:#fff;border-radius:12px;box-shadow:0 10px 40px rgba(0,0,0,0.25);">
      <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #e2e8f0;padding-bottom:12px;margin-bottom:12px;">
        <div>
          <h3 style="margin:0;font-size:16px;color:#0f172a;display:flex;align-items:center;gap:8px;">
            <span>⚙️</span> Tuỳ chỉnh chi tiết các cột — <b>${tableName || tableId}</b>
          </h3>
          <p style="margin:4px 0 0;font-size:12px;color:#64748b;">
            Kéo thả ⠿ hoặc ấn ▲▼ để đổi thứ tự, bật/tắt hiển thị, căn lề, xuống dòng, kích thước &amp; cố định cột.
          </p>
        </div>
        <button id="btnColConfigCloseX" class="btn small" style="font-size:14px;padding:4px 8px;">✕</button>
      </div>

      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;gap:8px;">
        <div style="display:flex;gap:6px;">
          <button id="btnColCheckAll" class="btn small" type="button">Hiện tất cả</button>
          <button id="btnColUncheckAll" class="btn small" type="button">Bỏ chọn hết</button>
          <button id="btnColAutoWidth" class="btn small" type="button" title="Đặt độ rộng tất cả các cột về Tự động">Rộng: Tự động</button>
          <button id="btnColResetDefault" class="btn small" type="button" style="color:#b91c1c;border-color:#fca5a5;">Khôi phục mặc định</button>
        </div>
        <span style="font-size:12px;color:#64748b;">Tổng: <b>${workingConfig.length}</b> cột</span>
      </div>

      <!-- Header danh sách cột -->
      <div style="display:flex;align-items:center;gap:10px;padding:7px 10px;font-size:11px;font-weight:700;color:#64748b;letter-spacing:0.3px;background:#f1f5f9;border:1px solid #e2e8f0;border-bottom:1px solid #cbd5e1;border-radius:8px 8px 0 0;box-sizing:border-box;">
        <span style="width:170px;text-align:left;padding-left:54px;">TÊN CỘT</span>
        <span style="width:80px;text-align:center;">CĂN LỀ</span>
        <span style="width:26px;text-align:center;" title="Xuống dòng">DÒNG</span>
        <span style="width:86px;text-align:center;">RỘNG (PX)</span>
        <span style="width:68px;text-align:center;">CỐ ĐỊNH</span>
      </div>

      <div id="colConfigList" style="flex:1;overflow-y:auto;max-height:55vh;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 8px 8px;padding:8px;background:#f8fafc;"></div>

      <div style="display:flex;justify-content:flex-end;align-items:center;gap:10px;border-top:1px solid #e2e8f0;padding-top:14px;margin-top:12px;">
        <button id="btnColConfigCancel" class="btn" type="button">Huỷ</button>
        <button id="btnColConfigSave" class="btn primary" type="button" style="background:#0284c7;border-color:#0284c7;font-weight:700;">💾 Lưu &amp; Áp dụng</button>
      </div>
    </div>
  `;

  renderList();
  modal.classList.remove('hidden');

  // Nút đóng
  const close = () => modal.classList.add('hidden');
  modal.querySelector('#btnColConfigCloseX').onclick = close;
  modal.querySelector('#btnColConfigCancel').onclick = close;

  // Hiện tất cả
  modal.querySelector('#btnColCheckAll').onclick = () => {
    workingConfig.forEach((c) => (c.visible = true));
    renderList();
  };

  // Bỏ chọn hết
  modal.querySelector('#btnColUncheckAll').onclick = () => {
    workingConfig.forEach((c) => (c.visible = false));
    renderList();
  };

  // Đặt tất cả về tự động
  modal.querySelector('#btnColAutoWidth').onclick = () => {
    workingConfig.forEach((c) => (c.width = 0));
    renderList();
  };

  // Khôi phục mặc định
  modal.querySelector('#btnColResetDefault').onclick = () => {
    if (confirm('Khôi phục toàn bộ cột về trạng thái mặc định ban đầu?')) {
      workingConfig = resetTableConfig(tableId, defaultCols);
      renderList();
    }
  };

  // Lưu & Áp dụng
  modal.querySelector('#btnColConfigSave').onclick = () => {
    saveTableConfig(tableId, workingConfig);
    applyTableStyles(tableId, workingConfig);
    close();
    if (typeof onSave === 'function') {
      onSave(workingConfig);
    }
  };
}
