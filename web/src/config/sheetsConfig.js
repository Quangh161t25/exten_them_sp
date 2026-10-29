import '../../../shared/google-config.js';

const SHARED = globalThis.SHARED_GOOGLE_CONFIG;

export const CONFIG = {
    spreadsheetId: SHARED.webSpreadsheetId,
    serviceAccountEmail: SHARED.serviceAccountEmail,
    privateKey: SHARED.privateKey,
    tokenUrl: SHARED.tokenUrl,
    tabs: {
        'DS_SP': {
            range: 'DS_SP!A2:L',
            headers: ['id_sp_con', 'id_sp', 'ten_sp', 'gia_nhap_ncc', 'gia_ban', 'gia_dong_goi', 'gia_thap_nhat', 'id_sp_gian', 'udt', 'tinh_trang', 'anh', 'gia_đăng'],
            priceCols: [3, 4, 5, 6, 11],
            imgCol: 10
        },
        'TINH_GIA': {
            range: 'DS_SP!A2:L',
            headers: ['id_sp_con', 'id_sp', 'ten_sp', 'gia_nhap', 'gia_ban', 'gia_đong_goi', 'gia_thap_nhat', 'loi_nhuan%', 'lai_mong_muon', 'gia_đăng', 'phi_ads_%', 'phi_aff_%', '11%_phi_co_dinh', 'phi_co_dinh', '6%_phi_giao_dich', 'phi_giao_dich', '5.5% xtra', 'xtra', '1,5%_thue', 'thue', 'phi_ha_tang3.000_₫', 'phi_piship'],
            displayHeaders: ['id_sp_con', 'id_sp', 'anh', 'ten_sp', 'gia_ban', 'gia_thap_nhat', 'loi_nhuan%', 'lai_mong_muon', 'gia_đăng', 'phi_ads_%', 'phi_aff_%', '11%_phi_co_dinh', 'phi_co_dinh', '6%_phi_giao_dich', 'phi_giao_dich', '5.5% xtra', 'xtra', '1,5%_thue', 'thue', 'phi_ha_tang3.000_₫', 'phi_piship'],
            priceCols: [3, 4, 5, 6, 8, 9, 13, 15, 17, 19, 20, 21]
        },
        'SP_BO': {
            range: 'SP_BO!A2:C',
            headers: ['id_sp_con', 'id_sp', 'ten_sp'],
            displayHeaders: ['id_sp_con', 'id_sp', 'ten_sp']
        },
        'SP_GIAM_GIA': {
            range: 'SP_GIAM_GIA!A2:I',
            headers: ['Mã sản phẩm', 'Tên Sản phẩm', 'Số SKU Sản phẩm', 'Mã phân loại hàng', 'Tên phân loại hàng', 'Số SKU Phân loại hàng', 'Giá gốc', 'Giá đã giảm', 'gian'],
            priceCols: [6, 7]
        },
        'WEB_SP': {
            range: 'WEB_SP!A2:O',
            headers: ['id', 'gian', 'sku', 'phan_loai', 'ten_sp', 'nganh_hang', 'mo_ta', 'anh', 'anh_mota', 'anh_phan_loai', 'link_video', 'gia', 'gia_khuyen_mai', 'id_shopee', 'link_shopee'],
            displayHeaders: ['id', 'gian', 'sku', 'phan_loai', 'ten_sp', 'nganh_hang', 'mo_ta', 'anh', 'anh_mota', 'anh_phan_loai', 'link_video', 'gia', 'gia_khuyen_mai', 'id_shopee', 'link_shopee'],
            priceCols: [11, 12],
            imgCol: 7
        },
        'DH': {
            range: 'DH!A2:AA',
            headers: ['gian', 'ngay', 'ngay_gio', 'mdh', 'mvd', 'tong_tien', 'ma_giam_gia', 'phi_vc', 'phu_phi', 'thue', 'doanh_thu', 'phi_khac', 'tien_sp', 'loi_nhuan', 'tinh_trang', 'trang_thai', 'sku', 'id_sp', 'slg', 'don_gia', 'thanh_tien', 'ten_khach', 'ng_nhan', 'dia_chi', 'link_don', 'mvd_huy', 'mdh_huy'],
            displayHeaders: ['gian', 'ngay', 'mdh', 'mvd', 'mvd_huy', 'mdh_huy', 'tong_tien', 'ma_giam_gia', 'phi_vc', 'phu_phi', 'thue', 'doanh_thu', 'phi_khac', 'tien_sp', 'loi_nhuan', 'tinh_trang', 'trang_thai', 'ten_khach', 'ng_nhan', 'dia_chi', 'link_don'],
            priceCols: [5, 6, 7, 8, 9, 10, 11, 12, 13, 19, 20]
        },
        'QUET_SP': {
            range: 'QUET_SP!A2:V',
            headers: ['id', 'ten_shop', 'id_shopee', 'ten_sp', 'phan_loai', 'sku', 'gia_goc', 'gia_km', 'voucher_shop', 'gia_sau_voucher', 'ton_kho', 'da_ban', 'danh_gia', 'nganh_hang', 'thuong_hieu', 'link_sp', 'anh_phan_loai', 'anh_chinh', 'anh_mota', 'link_video', 'mo_ta', 'thoi_gian_luu'],
            displayHeaders: ['id', 'ten_shop', 'id_shopee', 'ten_sp', 'phan_loai', 'sku', 'gia_goc', 'gia_km', 'voucher_shop', 'gia_sau_voucher', 'ton_kho', 'da_ban', 'danh_gia', 'nganh_hang', 'thuong_hieu', 'link_sp', 'anh_phan_loai', 'anh_chinh', 'anh_mota', 'link_video', 'mo_ta', 'thoi_gian_luu'],
            priceCols: [6, 7, 9],
            imgCol: 16
        }
    }
};

export const TAB_TITLES = {
    'DS_SP': 'DS SP',
    'TINH_GIA': 'TÍNH GIÁ',
    'SP_BO': 'SP BỎ',
    'SP_GIAM_GIA': 'SP GIẢM GIÁ',
    'WEB_SP': 'WEB SP',
    'DH': 'ĐH',
    'CHO_LAY_HANG': 'CHỜ LẤY HÀNG',
    'AUTO_CHAT': 'AUTO CHAT',
    'THI_TRUONG': 'THỊ TRƯỜNG',
    'QUET_SP': 'QUÉT SP'
};

// Đồng bộ hai chiều với Chrome Extension (customSpreadsheetId)
if (typeof chrome !== 'undefined' && chrome?.storage?.local) {
    chrome.storage.local.get(['customSpreadsheetId'], (res) => {
        if (res?.customSpreadsheetId && res.customSpreadsheetId.trim()) {
            CONFIG.spreadsheetId = res.customSpreadsheetId.trim();
        }
    });
    chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace === 'local' && changes.customSpreadsheetId) {
            const nextId = changes.customSpreadsheetId.newValue || '';
            if (nextId.trim()) {
                CONFIG.spreadsheetId = nextId.trim();
            }
        }
    });
}

