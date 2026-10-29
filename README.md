# Shopee Quản Lý SP

Một dự án gồm **Chrome Extension** hỗ trợ Shopee Kênh Người Bán và **Web BCE** (React) quản lý đơn hàng / sản phẩm / tính giá. Dữ liệu dùng chung qua Google Sheets.

## Cấu trúc

```
exten them sp12/              ← thư mục "Load unpacked" trong Chrome (giữ nguyên để không đổi ID extension)
├─ manifest.json              ← manifest của extension
├─ package.json, vite.config.js
├─ shared/
│  └─ google-config.js        ← cấu hình Google Service Account DUY NHẤT (extension + web cùng dùng)
├─ extension/
│  ├─ background.js           ← service worker (Google Sheets, upload ảnh, alarm)
│  ├─ popup/                  ← side panel: popup.html, popup.js, popup.css
│  │  ├─ tabs/                ← mỗi tab một file *_tab.js
│  │  └─ images/
│  ├─ content/                ← content script: Shopee, ChatGPT, Gemini, Wameli...
│  ├─ lib/                    ← xlsx, pdf-lib, html2pdf, jsrsasign
│  ├─ pages/camera.html
│  ├─ tai-anh-shopee/         ← module tải ảnh Shopee
│  ├─ flash-sale/             ← Flash Sale Tool: app.html (quản lý SP & Flash Sale) + tự động đăng ký
│  ├─ order-tool/             ← Order Tool: app.html (đơn Shopee, In phiếu + Wameli) + wameli.html
│  ├─ hub/                    ← Seller Hub: 1 trang gộp Flash Sale + Order Tool, menu bên trái
│  ├─ autoin/                 ← AutoIn (TOPCARE – Đọc đơn hàng): tự xác nhận lấy hàng, in phiếu, nạp Wameli, Telegram
│  ├─ clone-tool/             ← Sao chép sản phẩm (Shopee Clone Tool): sao chép SP shopee.vn sang shop + ảnh bìa AI
│  └─ icons/
├─ web/                       ← nguồn Web BCE (React + Vite)
│  ├─ index.html
│  └─ src/
├─ dist/                      ← bản build của web (extension mở dist/index.html)
├─ tools/server.py            ← server chạy web độc lập + proxy tìm ảnh Bing
└─ archive/                  ← code cũ không còn dùng (giữ lại để tham khảo)
```

## Cài extension

1. `chrome://extensions` → bật **Developer mode** → **Load unpacked** → chọn thư mục gốc dự án.
2. Sau khi sửa code extension: bấm **Reload** trên thẻ extension.

## Web BCE

```bash
npm install
npm run dev               # chạy dev tại http://localhost:5173
npm run build             # build web ra dist/ + đóng gói background Flash Sale
npm run build:fs          # chỉ đóng gói background Flash Sale
npm run build:standalone  # build 1 file HTML duy nhất ra dist-standalone/index.html
npm run serve             # chạy dist/ bằng tools/server.py (cổng 8000)
```

Trong extension, web mở tại `chrome-extension://<id>/dist/index.html`.

### Tab CHỜ LẤY HÀNG — đồng bộ Google Sheets

- Auto In đồng bộ danh sách chưa xử lý và đã xử lý/chờ bưu tá vào sheet **ĐƠN CHƯA XLY** trong bảng tính `shared/google-config.js → webSpreadsheetId`.
- Sheet tự tạo 23 cột; một sản phẩm/phân loại là một dòng. Đơn có nhiều sản phẩm chỉ tính tổng tiền một lần trên web.
- Mỗi mã gian có snapshot riêng. Chỉ thay snapshot sau khi tải đủ cả hai nhóm trạng thái và đủ thẻ đơn. Đơn không còn chờ lấy hàng (đang giao/hủy) bị loại khỏi snapshot của gian đó; dữ liệu gian khác được giữ lại.
- Nhập **Mã gian** trong Auto In, mở tab Shopee đã đăng nhập, bấm **Đọc ngay**. Đồng bộ nền tiếp tục theo chu kỳ Tự đọc (mặc định 2 phút), độc lập nút tự xác nhận/in đơn.
- Web `?tab=CHO_LAY_HANG` đọc trực tiếp sheet, không cần extension trên thiết bị xem. Có lọc gian, trạng thái, tìm tên/SKU và thời điểm đồng bộ. Mặc định làm mới 300 giây; lỗi đọc giữ dữ liệu đang hiển thị.
- Sau khi cập nhật extension cần Reload ở `chrome://extensions`. Deploy web: `npm run build`, đưa `dist/` lên hosting.
- Không sửa thứ tự/tên 23 cột của sheet đồng bộ. Nếu header sai hoặc danh sách Shopee bị thiếu, đồng bộ dừng và ghi lỗi trong Nhật ký hoạt động để tránh xóa nhầm.

## Cấu hình Google

Mọi thông tin service account và Spreadsheet ID mặc định nằm ở `shared/google-config.js`.
Có thể đổi Spreadsheet ID lúc chạy bằng tab Cài đặt (`customSpreadsheetId`).

## Flash Sale Tool

- Mở từ side panel: tab **🔥 Flash Sale** → **Mở trang quản lý Flash Sale** (`extension/flash-sale/app.html`).
- Giao diện (`app.js`, `products-tab.js`…) là ES module, sửa xong chỉ cần Reload extension.
- Phần chạy ngầm (`background-entry.js`, `scheduler.js`, `storage.js`, `shopee-api.js`, `flashsale.js`) được đóng gói
  thành `fs-background.bundle.js` để background chính nạp bằng `importScripts`.
  **Sửa các file này xong phải chạy `npm run build:fs`** rồi Reload extension.
- Dữ liệu lưu với khóa `fs_*` (fs_settings, fs_rules, fs_logs, fs_productCache, fs_mediaCache_v3).

## Order Tool

- Mở từ side panel: tab **📦 Đơn Tool** → **Mở quản lý đơn Shopee** (`extension/order-tool/app.html`)
  hoặc **Mở Đơn & Sản phẩm Wameli** (`extension/order-tool/wameli.html`).
- Toàn bộ là ES module chạy trong trang, không có phần chạy ngầm: sửa xong chỉ cần Reload extension.
- Hướng dẫn chi tiết các chức năng: `extension/order-tool/README.md`.
- Dữ liệu đơn lưu trong IndexedDB `ShopeeOrderToolDB`; cài đặt lưu trong chrome.storage
  (arrangePickupAddress, shipWameliPrefs, shipWameliSeq, wameliUploadForm, wameliUploadPrefs, wameliUser, wameliPass).

## Seller Hub (trang chung)

- `extension/hub/index.html`: menu bên trái (Flash Sale: Sản phẩm, Danh sách, Tạo/Sửa, Tự động đăng ký, Nhật ký;
  Đơn hàng: Đơn Shopee, Đơn xuất kho WML, Sản phẩm WML), bên phải là trang của từng tool trong iframe (nạp 1 lần, giữ trạng thái).
- Nút mở Flash Sale / Đơn Tool trong side panel đều mở trang này (`?m=fs-list`, `?m=order-shopee`...).
- Trang tool nằm trong hub thì ẩn thanh tab cũ (`extension/hub/embed.js` gắn class `embedded`).

## Sao chép sản phẩm (Shopee Clone Tool)

- Side panel → tab **Sao chép sản phẩm**: nhúng `extension/clone-tool/app.html` (nạp khi mở tab lần đầu).
- Content script: `clone-tool/content/shopee-hook.js` + `shopee-relay.js` (shopee.vn, đọc dữ liệu sản phẩm trang tự tải),
  `clone-tool/content/ai-chat.js` (Gemini / ChatGPT: dán ảnh + prompt, lấy ảnh bìa).
- Phần chạy ngầm `clone-tool/background.js` là script thường, background chính nạp bằng `importScripts` (không cần build).
- Hướng dẫn chi tiết: `extension/clone-tool/README.md`.

## AutoIn (TOPCARE – Đọc đơn hàng)

- Side panel → tab **AutoIn**: nhúng `extension/autoin/panel.html` (nạp khi mở tab lần đầu).
- Phần chạy ngầm `autoin/background.js` (script thường, bọc IIFE) được background chính nạp bằng `importScripts`:
  đọc đơn theo chu kỳ, tự xác nhận lấy hàng, in phiếu, tải PDF + Excel vào `TOPCARE-phieu-in/`, nạp Wameli,
  báo âm thanh (`autoin/offscreen.html`, quyền `offscreen`), gửi Telegram, tổng kết 17h & 8h.
- Bản gốc: `archive/extension-doc-don-original/`. Hướng dẫn chi tiết: `extension/autoin/HUONG-DAN.md`.

## Auto Chat — danh sách khách và hội thoại trên Google Sheets

- Tab **AUTO CHAT** trên web (`?tab=AUTO_CHAT`) đọc `AUTO_CHAT` (13 cột) và `NOI_DUNG_CHAT` (10 cột), trong cùng bảng tính web.
- Chrome extension đồng bộ chỉ đọc mỗi phút, kể cả khi chế độ tự gửi đang tắt; không tự bật Auto Chat. Cần Shopee đã đăng nhập và Mã gian đã nhập ở Auto In.
- Auto Chat trong side panel có nút **Đồng bộ khách & hội thoại lên Sheet**, hiển thị tiến độ và lỗi. Lần đầu đọc theo từng trang, 5 trang lịch sử mỗi lượt; không giới hạn vào 50 khách đầu hoặc chỉ 3 ngày gần nhất như hàng đợi tự trả lời.
- Lưu hội thoại hai chiều theo ID shop + ID hội thoại + ID tin, không ghép theo tên khách, không xóa hội thoại đã xong. Nội dung ảnh/video/thẻ sản phẩm được biểu diễn bằng nhãn loại tin.
- Cột **Đã tự chat** dựa trên lần gửi Auto Chat thành công đã được ghi nhận; trả lời tay và gửi lỗi không được tính. Các lần gửi cũ đã mất khỏi bộ nhớ trước khi thêm tính năng không thể xác nhận lại chỉ bằng nội dung câu chào.
- Web có tìm kiếm cả nội dung hội thoại, lọc gian, lọc Chưa tự chat / Đã tự chat; bấm tên khách để xem lịch sử. Dữ liệu đang tải chưa hoàn tất được đánh dấu rõ, lỗi API/phân trang giữ lại dữ liệu cũ.
- Sau cập nhật cần Reload extension và bấm đồng bộ lần đầu. Kiểm thử: `node tools/test-chat-sheet.mjs`.
