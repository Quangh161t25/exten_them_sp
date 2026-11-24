# Cài extension "TOPCARE - Cảm ơn khách 1 chạm" (Chrome / Cốc Cốc / Edge)

1. Mở `chrome://extensions` (Edge: `edge://extensions`, Cốc Cốc: `coccoc://extensions`).
2. Bật **Chế độ dành cho nhà phát triển** (Developer mode) ở góc phải trên.
3. Bấm **Tải tiện ích đã giải nén** (Load unpacked) → chọn thư mục `extension-cam-on`.
4. Vào Kênh Người Bán → Quản lý đơn hàng. Cạnh mỗi tên người mua sẽ có nút **💚 Cảm ơn**.

## Cách dùng
- Bấm **💚 Cảm ơn** → khung chat với khách mở ra, lời cảm ơn được soạn sẵn theo sản phẩm và trạng thái đơn.
- Đọc lại, sửa nếu cần, rồi bấm **Enter** để gửi. Nút chuyển sang ✍️ để biết khách nào đã soạn.
- Mỗi lời cảm ơn ghép ngẫu nhiên từ nhiều câu mở đầu, trạng thái, mẹo dùng sản phẩm và câu kết, nên gần như không trùng nhau.

## Tuỳ chỉnh
- Sửa câu chữ trong `content.js` (các mảng `OPENERS`, `STATUS`, `TIPS`, `CLOSERS`).
- Muốn bấm là gửi luôn: đổi `const AUTO_SEND = false;` thành `true` rồi bấm nút tải lại extension. Khuyên để `false` để tránh gửi nhầm.
- Nếu Shopee đổi giao diện làm mất nút: báo Claude để cập nhật lại.

Lưu ý: Shopee cấm gửi số điện thoại/link ngoài sàn trong chat. Đừng thêm các nội dung đó vào mẫu câu.
