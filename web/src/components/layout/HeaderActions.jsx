import React, { useRef } from 'react';
import { RefreshCw, Upload, Plus, ArrowDownToLine, Zap, Columns3, Store, ListFilter } from 'lucide-react';
import { SearchBox, Grow, Dropdown, SelectFilter } from '../common/PageShell.jsx';

// part="toolbar": tìm kiếm + nút thao tác (vùng 3); part="filters": các ô lọc (vùng 4).
export default function HeaderActions({
    part = 'toolbar',
    currentTab,
    searchTerm,
    onSearchChange,
    truongFilter,
    onTruongFilterChange,
    storeFilter,
    onStoreFilterChange,
    storeOptions = [],
    onReload,
    onUploadFiles,
    onAddNew,
    onBatchMinPrice,
    onBatchDefaultFees,
    onSyncDsSp,
    onCustomizeColumns
}) {
    const fileInputRef = useRef(null);

    const handleFileSelect = (e) => {
        const files = Array.from(e.target.files || []);
        if (files.length > 0 && onUploadFiles) {
            onUploadFiles(files);
        }
        e.target.value = '';
    };

    const isDhTab = currentTab === 'DH';
    const isTinhGiaTab = currentTab === 'TINH_GIA';
    const showStoreFilter = currentTab === 'WEB_SP' || currentTab === 'SP_GIAM_GIA';

    if (part === 'filters') {
        if (isDhTab) return null;
        return (
            <>
                <Dropdown icon={ListFilter} label={truongFilter ? `Trường: ${truongFilter}` : 'Lọc theo Trường'} active={!!truongFilter}>
                    <div className="dh-dd-dates">
                        <label>Trường chứa<input autoFocus value={truongFilter} onChange={(e) => onTruongFilterChange(e.target.value)} placeholder="Nhập mã / tên trường..." /></label>
                        {truongFilter && <div className="dh-dd-quick"><button type="button" data-close onClick={() => onTruongFilterChange('')}>Bỏ lọc</button></div>}
                    </div>
                </Dropdown>
                {showStoreFilter && (
                    <SelectFilter icon={Store} name="Gian hàng" value={storeFilter} onChange={onStoreFilterChange} options={storeOptions.map((s) => [s, s])} allLabel="Tất cả gian hàng" />
                )}
            </>
        );
    }

    return (
        <>
            <SearchBox value={searchTerm} onChange={onSearchChange} placeholder="Tìm kiếm nhanh... (a / b: có cả a và b · a, b: a hoặc b)" />
            <Grow />
            {onCustomizeColumns && (
                <button type="button" className="dh-ghost" onClick={onCustomizeColumns} title="Kéo thả, ẩn/hiện, cố định, căn lề, độ rộng">
                    <Columns3 size={14} /><span>Tùy chỉnh cột</span>
                </button>
            )}
            {isTinhGiaTab && (
                <>
                    <button type="button" className="dh-ghost" onClick={onSyncDsSp} title="Đồng bộ sản phẩm mới & cập nhật giá từ sheet DS_SP sang TÍNH GIÁ, tự động tính toán các cột công thức và lưu dữ liệu thực vào Google Sheets">
                        <RefreshCw size={14} /><span>Đồng bộ từ DS_SP & tính lại</span>
                    </button>
                    <button type="button" className="dh-ghost" onClick={onBatchMinPrice} title="Đặt giá đăng = giá bán thấp nhất (hoặc 10% nếu chưa có) cho các dòng đã chọn hoặc tất cả">
                        <ArrowDownToLine size={14} /><span>Giá đăng = giá thấp nhất</span>
                    </button>
                    <button type="button" className="dh-ghost" onClick={onBatchDefaultFees} title="Điền các phí mặc định (11% Cố định, 6% GD, 5.5% XTRA, 1.5% Thuế) cho các dòng đã chọn hoặc tất cả">
                        <Zap size={14} /><span>Điền phí mặc định</span>
                    </button>
                </>
            )}
            {!isDhTab && (
                <>
                    <input type="file" ref={fileInputRef} style={{ display: 'none' }} multiple accept=".xlsx,.xls,.csv" onChange={handleFileSelect} />
                    <button type="button" className="dh-ghost" onClick={() => fileInputRef.current?.click()} title={`Tải file Excel lên ${currentTab}`}>
                        <Upload size={14} /><span>Tải Excel lên</span>
                    </button>
                    <button type="button" className="dh-ghost" onClick={onAddNew} title="Thêm dòng mới">
                        <Plus size={14} /><span>Thêm mới</span>
                    </button>
                </>
            )}
            <button type="button" className="dh-primary" onClick={onReload} title="Tải lại dữ liệu">
                <RefreshCw size={14} /><span>Làm mới</span>
            </button>
        </>
    );
}
