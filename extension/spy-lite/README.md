# Shopee Spy Lite

Extension Chrome (MV3) tối giản, **chỉ có 2 chức năng** tách ra từ AutoShopee Kit, chạy trên `shopee.vn`.

## 2 chức năng

### 1. Spy sản phẩm
Tự chèn một dải số liệu dưới **mỗi sản phẩm** ở trang tìm kiếm:
- **Vị trí** (#thứ hạng trên trang kết quả)
- **Lượt bán/tháng** (`monthly_sold_count`)
- **Doanh số** = lượt bán tháng × giá
- **Bán tổng** (`historical_sold_count`)
- **Giá**, **Ngày tạo**, **Shop** (kèm cờ Yêu thích/Mall), **Thương hiệu**

### 2. Spy từ khóa
Nút nổi **“Spy từ khóa”** góc phải → mở popup tổng hợp cả trang kết quả của từ khóa hiện tại:
- KPI: **Ngành con · Thương hiệu · Shop · Đã bán · Doanh số**
- Bảng **Top bán chạy** (Sản phẩm · Giá · Đã bán · Doanh số)

## Cách hoạt động
- `src/bridge-main.js` (MAIN world): vá `fetch`/`XHR` để **bắt thụ động** response `/api/v4/search/search_items` khi bạn lướt, và cho phép **fetch chủ động** (kèm `csrftoken`) khi bấm Spy từ khóa.
- `src/content.js` (ISOLATED world): chuẩn hóa dữ liệu, chèn số liệu dưới sản phẩm, dựng popup tổng hợp.

Giống cơ chế bản gốc (`shopee-fetch.js` + `shopee-client.js`), không phụ thuộc backend AutoShopee.

## Cài đặt
1. Mở `chrome://extensions`
2. Bật **Developer mode** (góc phải trên)
3. **Load unpacked** → chọn thư mục `shopee-spy-lite`
4. Mở `https://shopee.vn/search?keyword=...`, đăng nhập, lướt kết quả.

> Lưu ý: Shopee có thể đổi cấu trúc DOM/API; nếu không thấy số liệu, mở DevTools Console kiểm tra và cập nhật selector trong `content.js` (`SLUG_RE`, `a.contents[href*='-i.']`).
