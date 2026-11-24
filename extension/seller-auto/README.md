# Shopee Seller Auto

Extension Chrome (MV3) tự động hoá cho nhà bán Shopee, viết lại từ nhóm `/shopee/seller/auto/*` của AutoShopee Kit v3.56. Dữ liệu chỉ lưu trong máy, không cần tài khoản hay server riêng.

## Cài đặt
1. Mở `chrome://extensions`, bật **Developer mode**.
2. Bấm **Load unpacked** và chọn thư mục `shopee-seller-auto`.
3. Đăng nhập **banhang.shopee.vn** trong cùng trình duyệt.
4. Bấm icon extension để mở bảng điều khiển. Vào **Cài đặt → Kiểm tra** để chắc các API gọi được.

Lần đầu extension đang ở **Chế độ thử**: dùng dữ liệu giả, không gửi gì lên Shopee. Bỏ chọn ô này ở góc trái dưới để chạy thật.

## Tính năng
| Tính năng | Chạy | API (banhang.shopee.vn) |
|---|---|---|
| **Đẩy sản phẩm**: xoay vòng danh sách SP, giữ đủ ≤5 suất, theo khung giờ và ngày trong tuần | Nền, kiểm tra mỗi 5 phút | `POST /api/v3/opt/product/boost_product/?version=3.1.0` body `{"id": itemId}` (đã xác nhận từ request thật). Thời gian 4 giờ/lượt tự theo dõi trong máy |
| **Trả lời đánh giá**: lọc theo sao, mẫu có biến `{ten} {ma_don} {sao} {shop}`, biến thể ngẫu nhiên `---`, kèm chat tuỳ chọn | Nền mỗi N phút hoặc "Chạy ngay" | `search_shop_rating_comments_new`, `reply_shop_rating` |
| **Đánh giá người mua**: đánh giá đơn hoàn thành chưa đánh giá, kèm chat tuỳ chọn | Nền mỗi N phút (vài trang đầu) hoặc "Quét toàn bộ" | `order/search_order_list_index`, `get_order_list_card_list`, `order/rate_order` |
| **Gửi tin nhắn hàng loạt**: chiến dịch → thu thập khách (từ đánh giá / đơn hàng / dán userId hoặc username) → kịch bản nhiều bước (văn bản, sticker, ảnh, sản phẩm, voucher) → gửi có giãn cách, nghỉ, chống gửi trùng | Trong tab (phải để trang mở) | `webchat/api/v1.2/mini/messages` (ký `x-s` SHA-256 như bản gốc), `mini/conversation/redirection`, `coreapi/v1.2/images`, `marketing/v3/voucher/list` |

## Cấu trúc
- `background.js`: alarm mỗi phút, chạy các tác vụ đang bật, khoá để không chạy trùng với tab, báo khi cần đăng nhập lại.
- `lib/bridge.js`: chạy `fetch` bên trong tab banhang.shopee.vn (world MAIN) để dùng cookie đăng nhập.
- `lib/shopee.js`: toàn bộ API, mẫu nội dung và dữ liệu giả cho chế độ thử.
- `lib/jobs.js`: logic các tác vụ, dùng chung cho background và trang.
- `lib/store.js`: `chrome.storage.local` (cấu hình, nhật ký, thống kê, chiến dịch, khách).
- `pages/`: giao diện (một trang, điều hướng theo `#hash`).

## Lưu ý
- Tác vụ nền chỉ chạy khi Chrome đang mở. Extension tự mở một tab Kênh Người Bán (ghim) nếu chưa có.
- Gửi tin nhắn quá dày có thể bị Shopee hạn chế chat. Nên giữ mặc định: 5 giây/khách, nghỉ 60 giây sau 10 khách, không nhắn lại 1 khách trong 24 giờ.
- Bản gốc trả lời/đánh giá giới hạn số lượt theo gói trả phí; bản này không giới hạn, chỉ có "Tối đa mỗi lượt" do bạn đặt.
