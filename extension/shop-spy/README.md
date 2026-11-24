# Shop Spy – Phân tích shop Shopee

Extension Chrome (Manifest V3) độc lập, soi một shop Shopee: thông tin shop, toàn bộ sản phẩm,
đã bán, doanh thu ước tính, bán 30 ngày, top bán chạy, báo cáo, xuất Excel (CSV).

## Cài đặt
1. Mở `chrome://extensions`, bật **Developer mode**.
2. Bấm **Load unpacked** → chọn thư mục `shop-spy-extension`.
3. Mở `https://shopee.vn` và đăng nhập (extension gọi API Shopee qua tab này).

## Sử dụng
- Đang ở trang shop / sản phẩm Shopee → bấm icon extension, popup tự nhận diện và thống kê nhanh 40 SP.
- Bấm **Xem toàn bộ sản phẩm** → mở `spy.html?shopId=<id>` quét toàn shop.
- Có thể dán: link shop, link sản phẩm (`...-i.<shopid>.<itemid>`), `shopee.vn/shop/<id>`, username hoặc shop ID.

## Cấu trúc
- `background.js` – chạy `fetch` API Shopee bên trong tab shopee.vn (world MAIN, dùng cookie của bạn).
- `lib/api.js` – gọi API (`get_shop_base_v2`, `shop/rcmd_items`), chuẩn hoá dữ liệu, format số.
- `popup.*` – thống kê nhanh. `spy.*` – trang phân tích đầy đủ (lọc, sắp xếp, phân trang, báo cáo, xuất CSV).

Lưu ý: doanh thu = đã bán × giá hiện tại, chỉ mang tính tham khảo. Nếu Shopee chặn (lỗi anti-bot),
hãy tải lại tab shopee.vn / xác minh captcha rồi thử lại.
