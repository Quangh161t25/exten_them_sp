import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
    ArrowUpDown,
    ArrowUp,
    ArrowDown,
    Search,
    Copy,
    Save,
    Settings
} from 'lucide-react';
import {
    formatDisplayNumber,
    escapeHtml,
    parseDhDate,
    parseMoney
} from '../../utils/formatters.js';
import { copyToClipboard, formatCustomCopyText } from '../../utils/clipboard.js';
import { isBtnInSpShopee } from '../../services/googleSheetsApi.js';
import DhSubrowItems from '../dh/DhSubrowItems.jsx';
import ColumnCustomizerModal from './ColumnCustomizerModal.jsx';

export default function DataTable({
    currentTab,
    rows = [],
    storageHeaders = [],
    displayHeaders = [],
    priceCols = [],
    selectedIds = new Set(),
    onToggleSelectRow,
    onToggleSelectAll,
    allSelectedOnPage = false,
    sortCol = null,
    sortDir = null,
    onSort,
    onRowDoubleClick,
    expandedSubrows = new Set(),
    onToggleSubrow,
    subrowItemsMap = new Map(),
    dsSpPriceMap = new Map(),
    dsSpNameMap = new Map(),
    onSaveSubrowItems,
    onOpenDhDetail,
    customButtons = [],
    spShopeeGianMap = new Map(),
    webSpImageMap = new Map(),
    onOpenImageSearch,
    onInlineChange,
    onSaveInline,
    onQuickLoiNhuan,
    onQuickGiaDang,
    onQuickFees,
    columnsRequest = 0
}) {
    const isDhTab = currentTab === 'DH';
    const isTinhGiaTab = currentTab === 'TINH_GIA';
    const isDsSpTab = currentTab === 'DS_SP';
    const hasCheckbox = isDhTab || isTinhGiaTab || isDsSpTab;

    const getRowId = (row) => {
        if (isDhTab) return String(row[3] || '').trim();
        return String(row[0] || '').trim();
    };

    const getHeaderDisplayName = (hdr) => {
        if (isDhTab) {
            if (hdr === 'ma_giam_gia') return 'MGG';
            if (hdr === 'doanh_thu') return 'DT';
        }
        return hdr;
    };

    const handleCopyGianLink = async (e, linkDon, gianVal, mdhVal) => {
        e.stopPropagation();
        const clean = String(linkDon || '').trim();
        if (!clean) {
            await copyToClipboard(gianVal, `📋 Đã copy gian hàng: ${gianVal}`);
        } else {
            await copyToClipboard(clean, `📋 Đã copy link đơn (${gianVal || mdhVal}): ${clean}`);
        }
    };

    const handleCopyCode = async (e, val, label) => {
        e.stopPropagation();
        const clean = String(val || '').trim();
        if (!clean) return;
        await copyToClipboard(clean, `📋 Đã copy ${label}: ${clean}`);
    };

    const handleCustomCopy = async (e, idSpCon, btnText, tenSp) => {
        e.stopPropagation();
        const formatted = formatCustomCopyText(idSpCon, btnText, tenSp);
        await copyToClipboard(formatted, `📋 Đã copy: ${formatted}`);
    };

    // For DH month groupings
    let lastMonthKey = null;

    // -------------------------------------------------------------------------
    // Column Customizer State & Persistence
    // -------------------------------------------------------------------------
    const [showColConfigModal, setShowColConfigModal] = useState(false);
    // Nút "Tùy chỉnh cột" ở thanh công cụ mở cùng hộp cấu hình cột.
    const lastColumnsRequest = useRef(columnsRequest);
    useEffect(() => {
        if (columnsRequest !== lastColumnsRequest.current) setShowColConfigModal(true);
        lastColumnsRequest.current = columnsRequest;
    }, [columnsRequest]);
    const storageKey = `web_dataTable_cols_${currentTab}`;

    const [tableColsConfig, setTableColsConfig] = useState(() => {
        try {
            const saved = localStorage.getItem(storageKey);
            if (saved) return JSON.parse(saved);
        } catch (e) {
            console.error('Error reading column config from localStorage', e);
        }
        return null;
    });

    useEffect(() => {
        try {
            const saved = localStorage.getItem(storageKey);
            if (saved) {
                setTableColsConfig(JSON.parse(saved));
                return;
            }
        } catch (e) {
            console.error('Error reading column config from localStorage', e);
        }
        setTableColsConfig(null);
    }, [currentTab, storageKey]);

    const handleSaveColsConfig = (newConfig) => {
        setTableColsConfig(newConfig);
        try {
            localStorage.setItem(storageKey, JSON.stringify(newConfig));
        } catch (e) {
            console.error('Error saving column config to localStorage', e);
        }
    };

    // Merge defaultHeaders with saved config
    const mergedColsConfig = useMemo(() => {
        const defaultList = (displayHeaders || []).map((hdr) => ({
            id: hdr,
            label: getHeaderDisplayName(hdr),
            visible: true,
            align: priceCols.includes(storageHeaders.indexOf(hdr)) ? 'right' : 'left',
            wrap: false,
            width: 0,
            fixed: false
        }));

        if (!tableColsConfig || !tableColsConfig.length) {
            return defaultList;
        }

        const savedMap = new Map(tableColsConfig.map((c) => [c.id, c]));
        const result = [];

        // Retain saved order for existing headers
        for (const c of tableColsConfig) {
            if (displayHeaders.includes(c.id)) {
                result.push({
                    ...c,
                    label: getHeaderDisplayName(c.id)
                });
                savedMap.delete(c.id);
            }
        }

        // Append any new headers not yet saved
        for (const hdr of displayHeaders) {
            if (!result.some((r) => r.id === hdr)) {
                result.push({
                    id: hdr,
                    label: getHeaderDisplayName(hdr),
                    visible: true,
                    align: priceCols.includes(storageHeaders.indexOf(hdr)) ? 'right' : 'left',
                    wrap: false,
                    width: 0,
                    fixed: false
                });
            }
        }

        return result;
    }, [displayHeaders, tableColsConfig, storageHeaders, priceCols, currentTab]);

    const activeCols = useMemo(() => {
        return mergedColsConfig.filter((c) => c.visible !== false);
    }, [mergedColsConfig]);

    const stickyInfo = useMemo(() => {
        const offsets = new Map();
        let currentLeft = hasCheckbox ? 42 : 36;
        let lastFixedId = null;

        for (const col of activeCols) {
            if (col.fixed) {
                offsets.set(col.id, currentLeft);
                const w = col.width > 0 ? col.width : 120;
                currentLeft += w;
                lastFixedId = col.id;
            }
        }
        return { offsets, lastFixedId };
    }, [activeCols, hasCheckbox]);

    const getCellStyle = (colConfig, isHeader = false, isChecked = false, rowIndex = 0) => {
        const style = {};
        if (!colConfig) return style;

        if (colConfig.width > 0) {
            style.width = `${colConfig.width}px`;
            style.minWidth = `${colConfig.width}px`;
            style.maxWidth = `${colConfig.width}px`;
        }

        if (colConfig.align) {
            style.textAlign = colConfig.align;
        }

        if (colConfig.wrap === true) {
            style.whiteSpace = 'normal';
            style.wordBreak = 'break-word';
        } else if (colConfig.wrap === false) {
            style.whiteSpace = 'nowrap';
        }

        if (colConfig.fixed && stickyInfo.offsets.has(colConfig.id)) {
            style.position = 'sticky';
            style.left = `${stickyInfo.offsets.get(colConfig.id)}px`;
            style.zIndex = isHeader ? 15 : 4;
            style.backgroundColor = isHeader
                ? '#f8fafc'
                : (isChecked ? '#f0f9ff' : (rowIndex % 2 === 0 ? '#ffffff' : '#fcfcfd'));
            if (stickyInfo.lastFixedId === colConfig.id) {
                style.borderRight = '2px solid #cbd5e1';
                style.boxShadow = '2px 0 5px -1px rgba(0, 0, 0, 0.08)';
            }
        }

        return style;
    };

    return (
        <div id="tableWrapper" className="table-wrapper" style={{ flex: 1, overflow: 'auto', background: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
            <table id="dataTable" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: '#f8fafc', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                    <tr>
                        {hasCheckbox ? (
                            <th
                                className="select-col"
                                style={{
                                    width: '42px',
                                    minWidth: '42px',
                                    maxWidth: '42px',
                                    textAlign: 'center',
                                    verticalAlign: 'middle',
                                    padding: '6px 4px',
                                    position: stickyInfo.offsets.size > 0 ? 'sticky' : undefined,
                                    left: stickyInfo.offsets.size > 0 ? 0 : undefined,
                                    zIndex: stickyInfo.offsets.size > 0 ? 20 : undefined,
                                    backgroundColor: '#f8fafc',
                                    borderBottom: '2px solid #cbd5e1'
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3px' }}>
                                    <input
                                        type="checkbox"
                                        checked={allSelectedOnPage}
                                        onChange={(e) => onToggleSelectAll && onToggleSelectAll(e.target.checked)}
                                        title="Chọn tất cả trên trang này"
                                        style={{ cursor: 'pointer' }}
                                    />
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setShowColConfigModal(true);
                                        }}
                                        title="Tùy chỉnh cột (kéo thả, ẩn/hiện, cố định, căn lề, độ rộng)"
                                        style={{
                                            background: 'transparent',
                                            border: 'none',
                                            padding: '2px',
                                            cursor: 'pointer',
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            color: '#64748b'
                                        }}
                                    >
                                        <Settings style={{ width: 13, height: 13 }} />
                                    </button>
                                </div>
                            </th>
                        ) : (
                            <th
                                className="settings-col"
                                style={{
                                    width: '36px',
                                    minWidth: '36px',
                                    maxWidth: '36px',
                                    textAlign: 'center',
                                    verticalAlign: 'middle',
                                    padding: '6px 4px',
                                    borderBottom: '2px solid #cbd5e1',
                                    position: stickyInfo.offsets.size > 0 ? 'sticky' : undefined,
                                    left: stickyInfo.offsets.size > 0 ? 0 : undefined,
                                    zIndex: stickyInfo.offsets.size > 0 ? 20 : undefined,
                                    backgroundColor: '#f8fafc'
                                }}
                            >
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setShowColConfigModal(true);
                                    }}
                                    title="Tùy chỉnh cột (kéo thả, ẩn/hiện, cố định, căn lề, độ rộng)"
                                    style={{
                                        background: '#f1f5f9',
                                        border: '1px solid #cbd5e1',
                                        borderRadius: '4px',
                                        padding: '2px 4px',
                                        cursor: 'pointer',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        color: '#475569'
                                    }}
                                >
                                    <Settings style={{ width: 13, height: 13 }} />
                                </button>
                            </th>
                        )}

                        {activeCols.map((colConfig) => {
                            const hdr = colConfig.id;
                            const isSorted = sortCol === hdr;
                            const displayName = colConfig.label || getHeaderDisplayName(hdr);
                            const colStyle = getCellStyle(colConfig, true);

                            return (
                                <th
                                    key={hdr}
                                    data-col={hdr}
                                    onClick={() => onSort && onSort(hdr)}
                                    style={{
                                        padding: '9px 10px',
                                        textAlign: colConfig.align || (priceCols.includes(storageHeaders.indexOf(hdr)) ? 'right' : 'left'),
                                        color: '#475569',
                                        fontWeight: 700,
                                        fontSize: '12px',
                                        textTransform: 'uppercase',
                                        whiteSpace: colConfig.wrap ? 'normal' : 'nowrap',
                                        cursor: 'pointer',
                                        userSelect: 'none',
                                        borderBottom: '2px solid #cbd5e1',
                                        ...colStyle
                                    }}
                                    title={`Bấm để sắp xếp theo ${displayName}`}
                                >
                                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                        <span>{displayName}</span>
                                        {isSorted ? (
                                            sortDir === 'asc' ? (
                                                <ArrowUp style={{ width: 13, height: 13, color: '#4f46e5' }} />
                                            ) : (
                                                <ArrowDown style={{ width: 13, height: 13, color: '#4f46e5' }} />
                                            )
                                        ) : (
                                            <ArrowUpDown style={{ width: 12, height: 12, opacity: 0.35 }} />
                                        )}
                                    </div>
                                </th>
                            );
                        })}

                        {isDsSpTab && (
                            <th style={{ width: '45px', textAlign: 'center', padding: '8px 4px', borderBottom: '2px solid #cbd5e1' }}>
                                Ảnh
                            </th>
                        )}
                    </tr>
                </thead>

                <tbody id="tableBody">
                    {rows.length === 0 ? (
                        <tr>
                            <td
                                colSpan={activeCols.length + 1 + (isDsSpTab ? 1 : 0)}
                                style={{ textAlign: 'center', padding: '60px 20px', color: '#94a3b8' }}
                            >
                                Không có dữ liệu phù hợp
                            </td>
                        </tr>
                    ) : (
                        rows.map((row, rowIndex) => {
                            const rowId = getRowId(row);
                            const isChecked = selectedIds.has(rowId);
                            const isSubrowExpanded = isDhTab && expandedSubrows.has(rowId);

                            // Month header logic for DH
                            let monthHeader = null;
                            if (isDhTab) {
                                const dateObj = parseDhDate(row[2]) || parseDhDate(row[1]);
                                const monthKey = dateObj ? `${String(dateObj.getMonth() + 1).padStart(2, '0')}/${dateObj.getFullYear()}` : 'Khác';
                                if (monthKey !== lastMonthKey) {
                                    lastMonthKey = monthKey;
                                    const monthTitle = (monthKey === 'Khác') ? 'KHÁC / CHƯA RÕ NGÀY' : `THÁNG ${monthKey}`;
                                    const monthCount = rows.filter(r => {
                                        const d = parseDhDate(r[2]) || parseDhDate(r[1]);
                                        const k = d ? `${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}` : 'Khác';
                                        return k === monthKey;
                                    }).length;

                                    monthHeader = (
                                        <tr key={`month_${monthKey}_${rowIndex}`} className="dh-month-group-row">
                                            <td
                                                colSpan={activeCols.length + 1}
                                                style={{
                                                    background: 'linear-gradient(90deg, #1e293b 0%, #334155 100%)',
                                                    color: '#ffffff',
                                                    padding: '7px 14px',
                                                    borderTop: '2px solid #0f172a',
                                                    borderBottom: '2px solid #0f172a',
                                                    verticalAlign: 'middle'
                                                }}
                                            >
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <span style={{ fontSize: '14px' }}>📅</span>
                                                        <span style={{ fontSize: '13px', fontWeight: 800, letterSpacing: '0.5px', textTransform: 'uppercase', color: '#f8fafc' }}>
                                                            {monthTitle}
                                                        </span>
                                                        {monthCount > 0 && (
                                                            <span
                                                                style={{
                                                                    background: 'rgba(255,255,255,0.2)',
                                                                    padding: '2px 8px',
                                                                    borderRadius: '12px',
                                                                    fontSize: '11px',
                                                                    fontWeight: 700,
                                                                    color: '#fff'
                                                                }}
                                                            >
                                                                {monthCount} đơn
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                }
                            }

                            return (
                                <React.Fragment key={row._sheetRow || rowIndex}>
                                    {monthHeader}
                                    <tr
                                        onDoubleClick={() => onRowDoubleClick && onRowDoubleClick(row)}
                                        style={{
                                            backgroundColor: isChecked ? '#f0f9ff' : rowIndex % 2 === 0 ? '#ffffff' : '#fcfcfd',
                                            borderBottom: '1px solid #f1f5f9',
                                            cursor: 'pointer'
                                        }}
                                        className="table-row"
                                    >
                                        {hasCheckbox ? (
                                            <td
                                                className="select-col"
                                                style={{
                                                    width: '42px',
                                                    minWidth: '42px',
                                                    maxWidth: '42px',
                                                    textAlign: 'center',
                                                    verticalAlign: 'middle',
                                                    padding: '6px 4px',
                                                    position: stickyInfo.offsets.size > 0 ? 'sticky' : undefined,
                                                    left: stickyInfo.offsets.size > 0 ? 0 : undefined,
                                                    zIndex: stickyInfo.offsets.size > 0 ? 5 : undefined,
                                                    backgroundColor: isChecked ? '#f0f9ff' : (rowIndex % 2 === 0 ? '#ffffff' : '#fcfcfd')
                                                }}
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={isChecked}
                                                    onChange={(e) => onToggleSelectRow && onToggleSelectRow(rowId, e.target.checked)}
                                                />
                                            </td>
                                        ) : (
                                            <td
                                                style={{
                                                    width: '36px',
                                                    minWidth: '36px',
                                                    maxWidth: '36px',
                                                    textAlign: 'center',
                                                    verticalAlign: 'middle',
                                                    padding: '4px',
                                                    color: '#94a3b8',
                                                    fontSize: '11px',
                                                    position: stickyInfo.offsets.size > 0 ? 'sticky' : undefined,
                                                    left: stickyInfo.offsets.size > 0 ? 0 : undefined,
                                                    zIndex: stickyInfo.offsets.size > 0 ? 5 : undefined,
                                                    backgroundColor: isChecked ? '#f0f9ff' : (rowIndex % 2 === 0 ? '#ffffff' : '#fcfcfd')
                                                }}
                                            >
                                                {rowIndex + 1}
                                            </td>
                                        )}

                                        {activeCols.map((colConfig) => {
                                            const header = colConfig.id;
                                            const storageIdx = storageHeaders.indexOf(header);
                                            const cell = (storageIdx >= 0 ? row[storageIdx] : row[header]) ?? '';
                                            const isNumeric = priceCols.includes(storageIdx);
                                            const cellStr = String(cell || '').trim();
                                            const colStyle = getCellStyle(colConfig, false, isChecked, rowIndex);

                                            // DH Special cell renderings
                                            if (isDhTab) {
                                                if (header === 'gian') {
                                                    const linkDonIdx = storageHeaders.indexOf('link_don');
                                                    const linkDonVal = linkDonIdx >= 0 ? String(row[linkDonIdx] || '').trim() : '';
                                                    const gianVal = String(row[0] || cell || '').trim();
                                                    const mdhVal = String(row[3] || '').trim();
                                                    return (
                                                        <td
                                                            key={header}
                                                            data-col="gian"
                                                            style={{ verticalAlign: 'middle', padding: '4px 8px', ...colStyle }}
                                                            onClick={(e) => handleCopyGianLink(e, linkDonVal, gianVal, mdhVal)}
                                                            title={linkDonVal ? `Bấm để copy link đơn: ${linkDonVal}` : 'Chưa có link đơn hàng'}
                                                        >
                                                            <span className="dh-gian-badge" style={{ fontWeight: 700, color: '#1e40af', background: '#eff6ff', border: '1px solid #bfdbfe', padding: '3px 8px', borderRadius: '6px', display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px' }}>
                                                                🏬 {gianVal} <span style={{ fontSize: '11px', opacity: 0.8 }}>📋</span>
                                                            </span>
                                                        </td>
                                                    );
                                                }

                                                if (header === 'mdh') {
                                                    const mdhVal = String(row[3] || cell || '').trim();
                                                    return (
                                                        <td
                                                            key={header}
                                                            data-col="mdh"
                                                            style={{ verticalAlign: 'middle', padding: '4px 8px', whiteSpace: 'nowrap', ...colStyle }}
                                                            onClick={(e) => handleCopyCode(e, mdhVal, 'Mã đơn hàng')}
                                                            title={`Click để sao chép MDH: ${mdhVal} (Double-click để mở chi tiết)`}
                                                        >
                                                            <span className="dh-code-badge" style={{ fontWeight: 700, color: '#0f172a', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                                                {mdhVal} <span style={{ fontSize: '11px', opacity: 0.6 }}>📋</span>
                                                            </span>
                                                        </td>
                                                    );
                                                }

                                                if (header === 'mvd') {
                                                    const mvdVal = String(cell || '').trim();
                                                    return (
                                                        <td
                                                            key={header}
                                                            data-col="mvd"
                                                            style={{ verticalAlign: 'middle', padding: '4px 8px', whiteSpace: 'nowrap', ...colStyle }}
                                                            onClick={(e) => mvdVal && handleCopyCode(e, mvdVal, 'Mã vận đơn')}
                                                            title={mvdVal ? `Click để sao chép MVD: ${mvdVal}` : 'Chưa có mã vận đơn'}
                                                        >
                                                            <span className="dh-code-badge" style={{ fontWeight: 600, color: '#334155', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                                                {mvdVal || '—'}{mvdVal && <span style={{ fontSize: '11px', opacity: 0.6 }}>📋</span>}
                                                            </span>
                                                        </td>
                                                    );
                                                }

                                                if (header === 'mvd_huy' || header === 'mdh_huy') {
                                                    const codeVal = String(cell || '').trim();
                                                    const label = header === 'mvd_huy' ? 'MVD hủy' : 'MDH hủy';
                                                    return (
                                                        <td
                                                            key={header}
                                                            data-col={header}
                                                            style={{ verticalAlign: 'middle', padding: '4px 8px', whiteSpace: 'nowrap', ...colStyle }}
                                                            onClick={(e) => codeVal && handleCopyCode(e, codeVal, label)}
                                                            title={codeVal ? `Click để sao chép ${label}: ${codeVal}` : `Chưa có ${label}`}
                                                        >
                                                            <span className="dh-code-badge" style={{ fontWeight: 600, color: codeVal ? '#dc2626' : '#94a3b8', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                                                {codeVal || '—'}{codeVal && <span style={{ fontSize: '11px', opacity: 0.6 }}>📋</span>}
                                                            </span>
                                                        </td>
                                                    );
                                                }

                                                if (header === 'tien_sp') {
                                                    const numVal = formatDisplayNumber(cell);
                                                    const mdhVal = String(row[3] || '').trim();
                                                    return (
                                                        <td key={header} data-col="tien_sp" style={{ verticalAlign: 'middle', padding: '4px 8px', textAlign: 'right', whiteSpace: 'nowrap', ...colStyle }}>
                                                            <span style={{ fontWeight: 700, color: '#0f172a' }}>{numVal}</span>
                                                            <button
                                                                type="button"
                                                                className="dh-expand-items-btn"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    onToggleSubrow && onToggleSubrow(mdhVal);
                                                                }}
                                                                style={{
                                                                    marginLeft: '6px',
                                                                    padding: '2px 6px',
                                                                    fontSize: '11px',
                                                                    background: isSubrowExpanded ? '#4338ca' : '#e0e7ff',
                                                                    color: isSubrowExpanded ? '#ffffff' : '#4338ca',
                                                                    border: `1px solid ${isSubrowExpanded ? '#3730a3' : '#c7d2fe'}`,
                                                                    borderRadius: '4px',
                                                                    cursor: 'pointer',
                                                                    display: 'inline-flex',
                                                                    alignItems: 'center',
                                                                    gap: '2px',
                                                                    verticalAlign: 'middle',
                                                                    fontWeight: 600
                                                                }}
                                                                title="Bấm xem chi tiết sản phẩm"
                                                            >
                                                                📦 {isSubrowExpanded ? '▴' : '▾'}
                                                            </button>
                                                        </td>
                                                    );
                                                }

                                                if (header === 'tinh_trang') {
                                                    const ttVal = String(cell || '').trim().toUpperCase();
                                                    let badge = null;
                                                    if (ttVal === 'HỦY') {
                                                        badge = <span style={{ padding: '2px 7px', borderRadius: '4px', fontWeight: 700, fontSize: '11px', background: '#fee2e2', color: '#dc2626', border: '1px solid #fca5a5' }}>❌ HỦY</span>;
                                                    } else if (ttVal === 'HOÀN') {
                                                        badge = <span style={{ padding: '2px 7px', borderRadius: '4px', fontWeight: 700, fontSize: '11px', background: '#ffedd5', color: '#ea580c', border: '1px solid #fed7aa' }}>↩️ HOÀN</span>;
                                                    } else if (ttVal === 'TRẢ') {
                                                        badge = <span style={{ padding: '2px 7px', borderRadius: '4px', fontWeight: 700, fontSize: '11px', background: '#fef3c7', color: '#d97706', border: '1px solid #fde68a' }}>🔄 TRẢ</span>;
                                                    } else if (ttVal === 'XONG') {
                                                        badge = <span style={{ padding: '2px 7px', borderRadius: '4px', fontWeight: 700, fontSize: '11px', background: '#dcfce7', color: '#16a34a', border: '1px solid #86efac' }}>✅ XONG</span>;
                                                    } else if (!ttVal) {
                                                        badge = <span style={{ padding: '2px 7px', borderRadius: '4px', fontWeight: 600, fontSize: '11px', background: '#f8fafc', color: '#94a3b8', border: '1px dashed #cbd5e1' }}>⚪ (Trống)</span>;
                                                    } else {
                                                        badge = <span style={{ padding: '2px 7px', borderRadius: '4px', fontWeight: 700, fontSize: '11px', background: '#e0e7ff', color: '#4338ca', border: '1px solid #c7d2fe' }}>{ttVal}</span>;
                                                    }
                                                    return <td key={header} data-col="tinh_trang" style={{ verticalAlign: 'middle', padding: '4px 8px', ...colStyle }}>{badge}</td>;
                                                }

                                                if (header === 'trang_thai') {
                                                    const thVal = String(cell || '').trim().toUpperCase();
                                                    let badge = null;
                                                    if (thVal === 'HỦY') {
                                                        badge = <span style={{ padding: '2px 7px', borderRadius: '4px', fontWeight: 700, fontSize: '11px', background: '#fee2e2', color: '#dc2626', border: '1px solid #fca5a5' }}>❌ HỦY</span>;
                                                    } else if (thVal === 'HOÀN TRẢ' || thVal === 'HOÀN') {
                                                        badge = <span style={{ padding: '2px 7px', borderRadius: '4px', fontWeight: 700, fontSize: '11px', background: '#ffedd5', color: '#ea580c', border: '1px solid #fed7aa' }}>↩️ HOÀN TRẢ</span>;
                                                    } else if (thVal === 'HOÀN THÀNH' || thVal === 'XONG') {
                                                        badge = <span style={{ padding: '2px 7px', borderRadius: '4px', fontWeight: 700, fontSize: '11px', background: '#dcfce7', color: '#16a34a', border: '1px solid #86efac' }}>✅ HOÀN THÀNH</span>;
                                                    } else if (thVal === 'XUNG ĐỘT' || thVal.includes('XUNG ĐỘT') || thVal.includes('XUNG DOT')) {
                                                        badge = <span style={{ padding: '2px 7px', borderRadius: '4px', fontWeight: 700, fontSize: '11px', background: '#fee2e2', color: '#b91c1c', border: '1px solid #f87171' }}>⚠️ XUNG ĐỘT</span>;
                                                    } else if (!thVal) {
                                                        badge = <span style={{ padding: '2px 7px', borderRadius: '4px', fontWeight: 600, fontSize: '11px', background: '#f8fafc', color: '#94a3b8', border: '1px dashed #cbd5e1' }}>⚪ (Trống)</span>;
                                                    } else {
                                                        badge = <span style={{ padding: '2px 7px', borderRadius: '4px', fontWeight: 700, fontSize: '11px', background: '#e0f2fe', color: '#0284c7', border: '1px solid #bae6fd' }}>{thVal}</span>;
                                                    }
                                                    return <td key={header} data-col="trang_thai" style={{ verticalAlign: 'middle', padding: '4px 8px', ...colStyle }}>{badge}</td>;
                                                }
                                            }

                                            // TINH_GIA Special cell renderings
                                            if (isTinhGiaTab) {
                                                if (header === 'anh') {
                                                    const idSp = String(row[1] || '').trim().substring(0, 4).toUpperCase() || String(row[0] || '').trim().substring(0, 4).toUpperCase();
                                                    const imgUrl = (webSpImageMap && idSp) ? webSpImageMap.get(idSp) : '';
                                                    if (imgUrl) {
                                                        return (
                                                            <td key={header} data-col="anh" style={{ textAlign: 'center', verticalAlign: 'middle', padding: '3px 6px', ...colStyle }}>
                                                                <a href={imgUrl} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
                                                                    <img
                                                                        src={imgUrl}
                                                                        alt="Product"
                                                                        style={{ width: '36px', height: '36px', objectFit: 'cover', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                                                                        onError={(e) => { e.target.style.display = 'none'; }}
                                                                    />
                                                                </a>
                                                            </td>
                                                        );
                                                    }
                                                    return <td key={header} data-col="anh" style={{ textAlign: 'center', color: '#cbd5e1', fontSize: '14px', padding: '3px 6px', ...colStyle }}>—</td>;
                                                }

                                                if (header === 'ten_sp' || header === 'ten_san_pham') {
                                                    const idSpConVal = String(row[0] || '').trim();
                                                    const tenSpVal = String(row[2] || '').trim();
                                                    return (
                                                        <td key={header} className="col-ten-sp" data-col={header} style={{ padding: '6px 10px', ...colStyle }}>
                                                            <div className="multiline-cell-wrapper" title={tenSpVal}>{tenSpVal}</div>
                                                            {customButtons.length > 0 && (
                                                                <div style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: '4px', marginTop: '5px' }}>
                                                                    {customButtons.map((bText) => {
                                                                        const isMatch = isBtnInSpShopee(bText, row, spShopeeGianMap);
                                                                        return (
                                                                            <button
                                                                                key={bText}
                                                                                type="button"
                                                                                className="copy-pill-btn"
                                                                                onClick={(e) => handleCustomCopy(e, idSpConVal, bText, tenSpVal)}
                                                                                style={{
                                                                                    background: isMatch ? '#10b981' : '#e0e7ff',
                                                                                    color: isMatch ? '#ffffff' : '#3730a3',
                                                                                    border: `1px solid ${isMatch ? '#059669' : '#c7d2fe'}`,
                                                                                    borderRadius: '4px',
                                                                                    fontSize: '11px',
                                                                                    fontWeight: 700,
                                                                                    padding: '2px 6px',
                                                                                    cursor: 'pointer',
                                                                                    display: 'inline-flex',
                                                                                    alignItems: 'center',
                                                                                    gap: '3px',
                                                                                    whiteSpace: 'nowrap'
                                                                                }}
                                                                                title={`Bấm để copy: ${formatCustomCopyText(idSpConVal, bText, tenSpVal)}`}
                                                                            >
                                                                                📋 {bText}
                                                                            </button>
                                                                        );
                                                                    })}
                                                                </div>
                                                            )}
                                                        </td>
                                                    );
                                                }

                                                if (header === 'loi_nhuan%') {
                                                    const val = cellStr.includes('%') ? cellStr : (cellStr ? `${cellStr}%` : '');
                                                    return (
                                                        <td key={header} style={{ padding: '4px 6px', ...colStyle }} onClick={(e) => e.stopPropagation()}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                                <input
                                                                    type="text"
                                                                    className="inline-edit-input"
                                                                    value={val}
                                                                    onChange={(e) => onInlineChange && onInlineChange(rowIndex, header, e.target.value)}
                                                                    onBlur={() => onSaveInline && onSaveInline(rowIndex)}
                                                                    onKeyDown={(e) => {
                                                                        if (e.key === 'Enter') {
                                                                            e.preventDefault();
                                                                            onSaveInline && onSaveInline(rowIndex);
                                                                        }
                                                                    }}
                                                                    style={{ width: '60px', textAlign: 'right', padding: '3px 6px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '12px', fontWeight: 600 }}
                                                                />
                                                                <button
                                                                    type="button"
                                                                    className="quick-btn-inline"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        onQuickLoiNhuan && onQuickLoiNhuan(row, rowIndex, 10);
                                                                    }}
                                                                    title="Đặt Lợi nhuận = 10%"
                                                                >
                                                                    10%
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    className="quick-btn-inline"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        onQuickLoiNhuan && onQuickLoiNhuan(row, rowIndex, 20);
                                                                    }}
                                                                    title="Đặt Lợi nhuận = 20%"
                                                                >
                                                                    20%
                                                                </button>
                                                            </div>
                                                        </td>
                                                    );
                                                }

                                                if (header === 'gia_đăng') {
                                                    const numGiaDang = parseMoney(cell);
                                                    const val = (cell === '' || cell === null || cell === undefined) ? '' : formatDisplayNumber(cell);
                                                    const roundedVal = numGiaDang > 0 ? Math.round(numGiaDang / 0.8) : 0;
                                                    return (
                                                        <td key={header} style={{ padding: '4px 6px', ...colStyle }} onClick={(e) => e.stopPropagation()}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                                                                <input
                                                                    type="text"
                                                                    className="inline-edit-input"
                                                                    value={val}
                                                                    onChange={(e) => onInlineChange && onInlineChange(rowIndex, header, e.target.value)}
                                                                    onBlur={() => onSaveInline && onSaveInline(rowIndex)}
                                                                    onKeyDown={(e) => {
                                                                        if (e.key === 'Enter') {
                                                                            e.preventDefault();
                                                                            onSaveInline && onSaveInline(rowIndex);
                                                                        }
                                                                    }}
                                                                    style={{ width: '95px', textAlign: 'right', padding: '3px 6px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '12px', fontWeight: 700 }}
                                                                />
                                                                <button
                                                                    type="button"
                                                                    className="quick-btn-inline"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        onQuickGiaDang && onQuickGiaDang(row, rowIndex);
                                                                    }}
                                                                    title="Điền Giá Thấp Nhất (hoặc 10% nếu chưa có)"
                                                                    style={{ padding: '2px 5px', fontSize: '11px' }}
                                                                >
                                                                    👇
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    className="quick-btn-inline"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        onQuickFees && onQuickFees(row, rowIndex);
                                                                    }}
                                                                    title="Điền Phí Mặc Định (11% Cố định, 6% Giao dịch, 5.5% XTRA, 1.5% Thuế)"
                                                                    style={{ padding: '2px 5px', fontSize: '11px' }}
                                                                >
                                                                    ⚡
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        copyToClipboard(numGiaDang, `✅ Đã copy Giá Đăng: ${formatDisplayNumber(numGiaDang)} đ`);
                                                                    }}
                                                                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', padding: '0 2px' }}
                                                                    title="Copy Giá Đăng"
                                                                >
                                                                    📋
                                                                </button>
                                                            </div>
                                                            {numGiaDang > 0 && (
                                                                <div style={{ display: 'flex', alignItems: 'center', color: '#64748b', fontSize: '11px', marginTop: '3px', fontWeight: 500 }}>
                                                                    <span title="Giá trước giảm 20% (Giá đăng / 0.8)">{formatDisplayNumber(roundedVal)}</span>
                                                                    <button
                                                                        type="button"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            copyToClipboard(roundedVal, `✅ Đã copy Giá trước giảm: ${formatDisplayNumber(roundedVal)} đ`);
                                                                        }}
                                                                        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '11px', marginLeft: '4px', padding: 0 }}
                                                                        title="Copy Giá trước giảm (Giá đăng / 0.8)"
                                                                    >
                                                                        📋
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </td>
                                                    );
                                                }

                                                const editableCols = ['lai_mong_muon', 'phi_ads_%', 'phi_aff_%', '11%_phi_co_dinh', '6%_phi_giao_dich', '5.5% xtra', '1,5%_thue'];
                                                if (editableCols.includes(header)) {
                                                    const isCurrency = (header === 'lai_mong_muon');
                                                    const val = (cell === '' || cell === null || cell === undefined)
                                                        ? ''
                                                        : (isCurrency ? formatDisplayNumber(cell) : (cellStr.includes('%') ? cellStr : cellStr + (cellStr ? '%' : '')));
                                                    return (
                                                        <td key={header} style={{ padding: '4px 6px', ...colStyle }}>
                                                            <input
                                                                type="text"
                                                                className="inline-edit-input"
                                                                value={val}
                                                                onClick={(e) => e.stopPropagation()}
                                                                onChange={(e) => onInlineChange && onInlineChange(rowIndex, header, e.target.value)}
                                                                onBlur={() => onSaveInline && onSaveInline(rowIndex)}
                                                                onKeyDown={(e) => {
                                                                    if (e.key === 'Enter') {
                                                                        e.preventDefault();
                                                                        onSaveInline && onSaveInline(rowIndex);
                                                                    }
                                                                }}
                                                                style={{ width: isCurrency ? '95px' : '65px', textAlign: 'right', padding: '3px 6px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '12px', fontWeight: 600 }}
                                                            />
                                                        </td>
                                                    );
                                                }
                                            }

                                            // General URLs
                                            if (cellStr.startsWith('http://') || cellStr.startsWith('https://')) {
                                                const parts = cellStr.split(',');
                                                return (
                                                    <td key={header} style={{ padding: '6px 10px', ...colStyle }}>
                                                        {parts.map((l, i) => (
                                                            <a
                                                                key={i}
                                                                href={l.trim()}
                                                                target="_blank"
                                                                rel="noreferrer"
                                                                onClick={(e) => e.stopPropagation()}
                                                                style={{ color: '#4f46e5', fontWeight: 600, textDecoration: 'none', marginRight: '6px', fontSize: '12px' }}
                                                            >
                                                                Link {parts.length > 1 ? i + 1 : ''}
                                                            </a>
                                                        ))}
                                                    </td>
                                                );
                                            }

                                            const displayValue = isNumeric ? formatDisplayNumber(cell) : cell;
                                            return (
                                                <td
                                                    key={header}
                                                    data-col={header}
                                                    style={{
                                                        padding: '7px 10px',
                                                        textAlign: isNumeric ? 'right' : 'left',
                                                        fontWeight: isNumeric ? 600 : 400,
                                                        whiteSpace: isNumeric ? 'nowrap' : 'normal',
                                                        ...colStyle
                                                    }}
                                                >
                                                    {displayValue}
                                                </td>
                                            );
                                        })}

                                        {isDsSpTab && (
                                            <td
                                                style={{ textAlign: 'center', padding: '4px 6px' }}
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                <button
                                                    type="button"
                                                    onClick={() => onOpenImageSearch && onOpenImageSearch(row, rowIndex)}
                                                    style={{
                                                        background: 'linear-gradient(135deg,#4f46e5,#7c3aed)',
                                                        color: '#fff',
                                                        border: 'none',
                                                        borderRadius: '6px',
                                                        padding: '4px 8px',
                                                        cursor: 'pointer',
                                                        fontSize: '12px',
                                                        fontWeight: 600
                                                    }}
                                                    title="Thêm / Tìm ảnh sản phẩm (Ghi Cột K)"
                                                >
                                                    🔍
                                                </button>
                                            </td>
                                        )}
                                    </tr>

                                    {/* Expanded subrow for DH */}
                                    {isDhTab && isSubrowExpanded && (
                                        <tr className="dh-subrow" style={{ background: '#f8fafc' }}>
                                            <td
                                                colSpan={activeCols.length + 1}
                                                style={{ padding: 0, borderTop: 'none' }}
                                            >
                                                <DhSubrowItems
                                                    mdh={rowId}
                                                    initialItems={subrowItemsMap.get(rowId) || []}
                                                    dsSpPriceMap={dsSpPriceMap}
                                                    dsSpNameMap={dsSpNameMap}
                                                    onSaveItems={onSaveSubrowItems}
                                                    onOpenDetail={onOpenDhDetail}
                                                />
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            );
                        })
                    )}
                </tbody>
            </table>

            <ColumnCustomizerModal
                isOpen={showColConfigModal}
                onClose={() => setShowColConfigModal(false)}
                tableName={`Bảng ${currentTab}`}
                defaultHeaders={displayHeaders}
                currentConfig={mergedColsConfig}
                onSave={handleSaveColsConfig}
                getHeaderDisplayName={getHeaderDisplayName}
            />
        </div>
    );
}
