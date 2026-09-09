const CONFIG = {
    spreadsheetId: "19gZ6mR4UnKjZiWQc-W5CrCBKD7xz02Szd4Amlqvu99Y",
    serviceAccountEmail: "ca-nhan@h161-508101.iam.gserviceaccount.com",
    privateKey: `-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC1XkzwY+oHzPmN
YnJ+sMKxe5TRTp8Md0Jb+PFApojE72HcVnXj14zFxFocyCPX1+dtwXJGJ/sSCyAh
iV3OtLEpxRU5QJponFszl9X6vmdLzDbzQS7VQTqMPv0JB+lHEYMU2B37hcIfpfJO
+l6EMprUA7NJtmeJpqmXKjsov6Rdt61sjyH/LKaYj0T2sLGazgZesp96sEOu83HM
nl+KPk9xafPOlKaE34Bk6zl4D8lFUK3v7opndvt/7IOBQ/RdI7p0v+HeOORGUuZW
kW3GH1vo6xY/uyrtmjD7+18w5vmAIRm24Satu0MJYz+j1JtqV4U5wwDkNelXBAWz
hKkfl5yxAgMBAAECggEAA9pDk+Epc943qFhQoo6Oai77+ai8AeuoHBRJCqSm99j2
aRPol+0Im1xZBi69rSxzyO3wp5sajxbvqSq19Im70C10rpVH2mRE3y8Q321LPC3T
tn3aWPMUY22Emjwh6U2uzULsex7roVi48ZLJrnD1Pz7vYGfYofDJfjGqVUqh2xA+
OSiz/U2JFTmePtrhxQGwaS8PHWyyUd+aiHz7pBg+tNzX0L+rMirPsN6i/ph+QolS
4YXubv94O/WL92helDjQuUyWbisYdkuLp2XxnB+5Oa/2fQY7+rhju4pcIm+zA+Wc
GdSzvLtL5hY9vLrZ8e4n0E/saILqViHSkRFksV1PaQKBgQDmEDaYQxmBeQsDbRJN
BLg5lNBCgEWWkW/GNcL9cT+IcmNSyiPAnk2jofQpvmbbBh1lYeCbOhE4HDotN8a8
hc1uRLb4K17fofhGV/znXW9Y12NcwZTkL5u4kKwDy8Qfx3PfckeLxA1s/3oS01tF
wrybv1aB3Vxain5axUps5v0x6QKBgQDJ0Ld9nqXGBrknORjF1uQ7vpp5wp4Haohy
FVNNfMzjKGRzKl8d4TxPVrUpShYBQE+v1pCwahOXCefovff32mQHzg4oVeml3bQq
otLFVVcydb1L8RY1R+QLbiqRy6Pnv5h4pB82eWg1i7xKuZvxZ68v6iPpEz+8zx0F
FJ9IGolPiQKBgBRF03nBV+sHzoejwdwVkWJJkbx6bydgc3gE3sTUiOOuKMBv3Yyo
pnDH4asYAxpDxK1dXZxwFnpaSmoXoySTqdGQrorZz4dnT2hrcna0zg4HFNNkn4ko
BNHTtcSz3Plr6vMCr/lJ8mDrdkdYZo+UJGiZCLdy2SOFVrMK9Y75H9CZAoGBAJcl
jTc06VztTiA1H/uT3K1uLA2DF43gWL5wgEopbN24M7sZAdHEDcIx405AIUjgnI3J
+eVWHMPi9GAYXq2vT3mU9n95EJtb9wJznb2TE9JD4fkNX5+Z7w4sfQ9iX6hCk3PP
H11SAh0QQX4JkuRyzf7pselutC65Qze54S1ESpBZAoGACkqjFmmF9I9jLZfJdWJM
hOdPNHJD8NcM7ixbO9FBMw6S7PeUE//IuKQQcnxm9FsxCFVo2Q16+XKYLryZ/QxD
cRUVkq/nAg4IB78jDp5Yc3n5VXAr10zWHWNFwVbdcZAs3BT9Q4WacASPdyowQPx0
JYdnFqf9hx1XKT04zZ49M7w=
-----END PRIVATE KEY-----`,
    tokenUrl: "https://oauth2.googleapis.com/token",
    tabs: {
        'SP_PM': {
            range: 'SP_PM!A2:AU',
            clearRange: 'SP_PM!A2:AU10000',
            headers: ['ID', 'Tên', 'Sản phẩm cha', 'Loại', 'Trạng thái', 'Mã', 'Mã vạch', 'Giá nhập', 'VAT(%)', 'Giá bán lẻ', 'Giá sỉ', 'Giá đón gói', 'Giá cũ', 'Danh mục', 'Thương hiệu', 'Khối lượng', 'Đơn vị tính', 'Dài', 'Rộng', 'Cao', 'Link hướng dẫn sử dụng', 'Ảnh', 'Xuất xứ', 'Địa chỉ bảo hành', 'Số điện thoại bảo hành', 'Số tháng bảo hành', 'Link video bảo hành', 'Tồn', 'Tổng tồn', 'Tạm giữ', 'Có thể bán', 'Giá bán thấp nhất', 'show_sku', 'sku_1', 'sku_2', 'sku_3', 'sku_con', 'sku_cha', 'gia_nhap', 'gia_ban', 'gia_dong_goi', 'gia_thap_nhat', 'sku_ct_ten', 'sku_ten', 'sku_bce', 'kt_1', 'kt_2'],
            priceCols: [7, 9, 10, 11, 12, 31, 38, 39, 40, 41],
            imgCol: 21
        },
        'SP_SHOPEE': {
            range: 'SP_SHOPEE!A2:M',
            clearRange: 'SP_SHOPEE!A2:M10000',
            headers: ['Mã Sản phẩm', 'Tên Sản phẩm', 'Mã Phân loại', 'Tên phân loại', 'SKU Sản phẩm', 'SKU', 'Giá', 'Giá niêm yết trực tiếp:MY', 'Giá niêm yết trực tiếp:PH', 'GTIN', 'Số lượng:KHO F', 'Số lượng:Kho HCM', 'Số lượng:Kho Hà Nội'],
            priceCols: [6, 7, 8],
            imgCol: -1
        },
        'DH_SHOPE': {
            range: 'DH_SHOPE!A2:S',
            clearRange: 'DH_SHOPE!A2:S100000',
            headers: ['mdh', 'ngay', 'mvd', 'Tổng số tiền Người mua thanh toán', 'Phí cố định', 'Phí Dịch Vụ', 'Phí thanh toán', 'piship', 'tiep_thi_lien_ket', 'thue', 'phi_khac', 'tien_mua', 'loi_nhuan', 'gc1', 'gc1', 'id_khach', 'ten_khach', 'sdt', 'dia_chỉ'],
            priceCols: [3, 4, 5, 6, 7, 9, 12],
            imgCol: -1
        },
        'DH_S': {
            range: 'DH_S!A2:BT',
            clearRange: 'DH_S!A2:BT100000',
            fullHeaders: ["Mã đơn hàng", "Mã Kiện Hàng", "Ngày đặt hàng", "Trạng Thái Đơn Hàng", "Sản Phẩm Bán Chạy", "Lý do hủy", "Nhận xét từ Người mua", "Mã vận đơn", "Đơn Vị Vận Chuyển", "Phương thức giao hàng", "Loại đơn hàng", "Ngày giao hàng dự kiến", "Ngày gửi hàng", "Thời gian giao hàng", "Trạng thái Trả hàng/Hoàn tiền", "SKU sản phẩm", "Tên sản phẩm", "Cân nặng sản phẩm", "Tổng cân nặng", "Tên kho hàng", "SKU phân loại hàng", "Tên phân loại hàng", "Giá gốc", "Người bán trợ giá", "Được Shopee trợ giá", "Tổng số tiền được người bán trợ giá", "Giá ưu đãi", "Số lượng", "Số lượng sản phẩm được hoàn trả", "Tổng số tiền Người mua thanh toán", "Tổng giá trị đơn hàng (VND)", "Mã giảm giá của Shop", "Hoàn Xu", "Mã giảm giá của Shopee", "Chỉ tiêu Combo Khuyến Mãi", "Giảm giá từ combo Shopee", "Giảm giá từ Combo của Shop", "Shopee Xu được hoàn", "Số tiền được giảm khi thanh toán bằng thẻ Ghi nợ", "Trade-in Discount", "Trade-in Bonus", "Phí vận chuyển (dự kiến)", "Trade-in Bonus by Seller", "Phí vận chuyển mà người mua trả", "Phí vận chuyển tài trợ bởi Shopee (dự kiến)", "Phí vận chuyển trả hàng (đơn Trả hàng/hoàn tiền)", "Tổng số tiền người mua thanh toán", "Thời gian hoàn thành đơn hàng", "Thời gian đơn hàng được thanh toán", "Phương thức thanh toán", "Phí cố định", "Phí Dịch Vụ", "Phí thanh toán", "Tiền ký quỹ", "Người Mua", "Tên Người nhận", "Số điện thoại", "Tỉnh/Thành phố", "TP / Quận / Huyện", "Quận", "Địa chỉ nhận hàng", "Quốc gia", "Ghi chú", "ngay_up_don", "piship", "phi_thue", "phi_khac", "tien_thu_ve", "gia_sp", "loi_nhuan", "tinh_trang", "trang_thai"],
            headers: ['Mã đơn hàng', 'Ngày đặt hàng', 'Mã vận đơn', 'SKU phân loại hàng', 'Số lượng', 'Tổng số tiền Người mua thanh toán', 'Phí cố định', 'Phí Dịch Vụ', 'Phí thanh toán', 'Tiền ký quỹ', 'Người Mua', 'Tên Người nhận', 'Số điện thoại', 'Địa chỉ nhận hàng'],
            displayCols: [0, 2, 7, 20, 27, 29, 50, 51, 52, 53, 54, 55, 56, 60],
            orderCols: ['push_thu_chi', 0, 2, 7, 63, 70, 71, 29, 50, 51, 52, 64, 65, 66, 67, 'tong_gia_sp', 69, 54, 'so_lan_mua', 55, 56, 60],
            orderHeaders: ['', 'Mã đơn hàng', 'Ngày đặt hàng', 'Mã vận đơn', 'ngay_up_don', 'tinh_trang', 'trang_thai', 'Tổng số tiền Người mua thanh toán', 'Phí cố định', 'Phí Dịch Vụ', 'Phí thanh toán', 'piship', 'phi_thue', 'phi_khac', 'tien_thu_ve', 'tổng giá sp', 'loi_nhuan', 'Người Mua', 'số lần mua', 'Tên Người nhận', 'Số điện thoại', 'Địa chỉ nhận hàng'],
            detailCols: [20, 27, 68],
            detailHeaders: ['SKU phân loại hàng', 'Số lượng', 'gia_sp'],
            priceCols: [5, 6, 7, 8, 9],
            rawPriceCols: [29, 50, 51, 52, 53, 64, 65, 66, 67, 68, 69],
            imgCol: -1
        },
        'DH_SHOPE_CT': {
            range: 'DH_SHOPE_CT!A2:J',
            clearRange: 'DH_SHOPE_CT!A2:J100000',
            headers: ['id', 'mdh', 'SKU phân loại hàng', 'Số lượng', 'sku', 'sku_ct', 'ten_sp', 'slg', 'don_gia', 'thanh_tien'],
            priceCols: [8, 9],
            imgCol: -1
        },
        'THU_CHI': {
            range: 'THU_CHI!A2:G',
            clearRange: 'THU_CHI!A2:G100000',
            headers: ['id', 'ngay', 'thu_chi', 'truong', 'mdh', 'mvd', 'so_tien'],
            hiddenCols: [0],
            priceCols: [6],
            imgCol: -1
        }
    }
};
