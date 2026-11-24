# Shopee Video Studio (Chrome MV3)

Extension độc lập: tải video sản phẩm Shopee, soạn & đăng video lên kênh Shopee Video (gắn ≤ 6 sản phẩm),
dashboard theo dõi trạng thái + lượt xem/thích/bình luận/chia sẻ. HTML/JS thuần, không cần build.

## Cài
1. `chrome://extensions` → bật **Developer mode** → **Load unpacked** → chọn thư mục `shopee-video-extension`.
2. Bấm biểu tượng extension để mở trang **Tổng hợp** (3 cột: Tải video | Soạn & đăng | Dashboard).
3. Trên shopee.vn: rê chuột vào thẻ sản phẩm (trang tìm kiếm, shop, gợi ý...) sẽ hiện nút **+ Video**; trang chi tiết sản phẩm có nút nổi **🎬 + Video**. Bấm để đưa sản phẩm vào cột Tải video (tab Tổng hợp / Tải video đang mở, hoặc mở tab Tổng hợp mới). Sau khi reload extension nhớ F5 lại trang Shopee.

## Chế độ thử (mặc định TẮT khi chạy trong extension)
Bật công tắc **Chế độ thử** ở thanh trên: dùng shop / sản phẩm / kết quả đăng giả, **không gọi Shopee**.
Ở Dashboard bấm **Nạp dữ liệu mẫu** để có sẵn chiến dịch & video mẫu.

## Trang
| Trang | Việc |
|---|---|
| `pages/studio.html` | Tổng hợp: 3 trang dưới đây đặt song song trong 3 cột; "Đăng video" ở cột 1 nạp vào cột 2, đăng/lưu xong cột 3 tự làm mới |
| `pages/download.html` | Dán link SP → xem video/ảnh, **Tải video**, **Tải tất cả ảnh**, **Đăng video** |
| `pages/compose.html` | Video (từ SP hoặc chọn file từ máy), chiến dịch (chọn / gõ tên mới), gắn ≤ 6 SP, tiêu đề, checklist, **Lưu vào hàng chờ** / **Đăng video** |
| `pages/dashboard.html` | Thống kê Chiến dịch/Tổng/Đã đăng/Lỗi/Chờ, chiến dịch tạo/đổi tên/xoá, lọc trạng thái, Đăng / Đăng lại / Đăng tất cả, sửa tiêu đề, đồng bộ chỉ số (tự đồng bộ nếu > 5 phút), xoá (hỏi riêng có xoá trên Shopee không), link Thống kê / Quản lý video trên Kênh Người Bán |

## Cách gọi Shopee
- Mọi request chạy trong tab Shopee bằng `chrome.scripting.executeScript({ world: 'MAIN' })` (`lib/bridge.js`), dùng cookie đăng nhập của bạn:
  - tab `shopee.vn`: `/api/v4/pdp/get_pc` (dữ liệu & video sản phẩm).
  - tab `banhang.shopee.vn/creator-center/...`: `creator.shopee.vn/publish/pc/api/*` (tìm SP, task create/edit/post, vid/info, video/list, video/delete),
    `api.mms.shopee.vn/uploadapi/api/v1/vod/preupload|reportupload`, PUT file lên kho S3 của Shopee (ký AWS SigV4), `banhang.shopee.vn/api/supply/sellercenter/video/detail` (chỉ số).
- File video được chuyển vào tab theo từng mảnh 2MB rồi PUT từ trong tab.
- Trước mỗi lần đăng thật / xoá trên Shopee đều có hộp thoại xác nhận.

## Dữ liệu
`chrome.storage.local`: `svx_campaigns`, `svx_items`, `svx_settings`. File video chọn từ máy: IndexedDB `svx_video_files`.
Không có server riêng; xoá extension là mất dữ liệu.

## Cần đăng nhập
- Tải video: mở được shopee.vn (nên đăng nhập để tránh anti-bot).
- Mọi thứ còn lại (shop, gắn SP, đăng, chỉ số, xoá): **Kênh Người Bán** banhang.shopee.vn.

## Chưa kiểm tra với Shopee thật
Đã thử giao diện + toàn bộ luồng bằng dữ liệu giả; đã kiểm MD5 (so với Node crypto), giải mã AES access_key (round-trip), parse link.
**Chưa** chạy với tài khoản thật: pdp/get_pc, item/list, preupload, PUT S3 (chữ ký SigV4, CORS), reportupload, task/*, video/list, video detail, video/delete.
Phần upload phụ thuộc định dạng nội bộ của Shopee (khoá giải mã `access_key`, mã trạng thái 100/300) và có thể hỏng khi Shopee thay đổi.
