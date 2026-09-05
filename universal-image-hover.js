(function () {
    // 1. Tạo duy nhất 1 Nút Floating Overlay ngoài document.body dạng Icon tròn nhỏ gọn
    let hoverBtn = document.getElementById('api-save-img-overlay-btn');
    if (!hoverBtn) {
        hoverBtn = document.createElement('div');
        hoverBtn.id = 'api-save-img-overlay-btn';
        hoverBtn.style.cssText = `
            position: fixed !important;
            display: none !important;
            z-index: 2147483647 !important;
            width: 28px !important;
            height: 28px !important;
            border-radius: 50% !important;
            background: #2563eb !important;
            color: #ffffff !important;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
            font-size: 14px !important;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4) !important;
            cursor: pointer !important;
            user-select: none !important;
            transition: transform 0.15s ease, background 0.15s ease !important;
            pointer-events: auto !important;
            align-items: center !important;
            justify-content: center !important;
            border: 1.5px solid #ffffff !important;
            box-sizing: border-box !important;
        `;
        hoverBtn.title = "Lưu ảnh vào Sheet LUU_ANH_API (Cột B link)";
        hoverBtn.innerHTML = '📥';
        
        // Đảm bảo nút được thêm vào body khi DOM sẵn sàng
        if (document.body) {
            document.body.appendChild(hoverBtn);
        } else {
            document.addEventListener('DOMContentLoaded', () => document.body.appendChild(hoverBtn));
        }
    }

    let currentTargetImgUrl = null;
    let activeTargetEl = null;
    let hideTimer = null;

    // 2. Thuật toán trích xuất URL ảnh thông minh
    function extractImageUrl(el, mouseX, mouseY) {
        if (!el) return null;

        // Trường hợp 1: Thẻ <img> chuẩn hoặc Lazy-load
        if (el.tagName === 'IMG') {
            const url = el.currentSrc || el.src || el.getAttribute('data-src') || el.getAttribute('data-original');
            if (url && !url.startsWith('data:image/svg')) return url;
        }

        // Trường hợp 2: Thẻ SVG <image>
        if (el.tagName === 'image' || el.tagName === 'IMAGE') {
            const url = el.getAttribute('href') || el.getAttribute('xlink:href');
            if (url) return url;
        }

        // Trường hợp 3: Thẻ div/span có Background Image
        const computedStyle = window.getComputedStyle(el);
        const bgImg = computedStyle.backgroundImage;
        if (bgImg && bgImg !== 'none') {
            const match = bgImg.match(/url\((['"]?)(.*?)\1\)/);
            if (match && match[2]) return match[2];
        }

        // Trường hợp 4: Lớp Overlay trong suốt che trên ảnh
        if (mouseX !== undefined && mouseY !== undefined) {
            const elementsAtPoint = document.elementsFromPoint(mouseX, mouseY);
            for (const subEl of elementsAtPoint) {
                if (subEl === el || subEl === hoverBtn) continue;
                
                if (subEl.tagName === 'IMG') {
                    const url = subEl.currentSrc || subEl.src || subEl.getAttribute('data-src');
                    if (url) return url;
                }
                const subStyle = window.getComputedStyle(subEl);
                if (subStyle.backgroundImage && subStyle.backgroundImage !== 'none') {
                    const match = subStyle.backgroundImage.match(/url\((['"]?)(.*?)\1\)/);
                    if (match && match[2]) return match[2];
                }
            }
        }

        return null;
    }

    // 3. Xử lý sự kiện Mousemove tối ưu hiệu năng với Throttle
    let lastExecution = 0;
    document.addEventListener('mousemove', function (e) {
        const now = Date.now();
        if (now - lastExecution < 40) return; // Throttle 40ms
        lastExecution = now;

        const target = e.target;
        if (target === hoverBtn || hoverBtn.contains(target)) return;

        const imgUrl = extractImageUrl(target, e.clientX, e.clientY);

        if (imgUrl) {
            clearTimeout(hideTimer);
            currentTargetImgUrl = imgUrl;
            activeTargetEl = target;

            // Tìm phần tử hiển thị kích thước gốc (ví dụ khung div/img)
            const targetEl = (target.tagName === 'IMG' || target.tagName === 'image') ? target : (activeTargetEl || target);
            const rect = targetEl.getBoundingClientRect();
            
            // Giới hạn hiển thị chỉ khi phần tử ảnh có kích thước đủ lớn (> 40x40px)
            if (rect.width > 40 && rect.height > 40) {
                // Đặt nút ở góc trên BÊN TRÁI của ảnh
                hoverBtn.style.top = `${Math.max(6, rect.top + 6)}px`;
                hoverBtn.style.left = `${Math.max(6, rect.left + 6)}px`;
                hoverBtn.style.setProperty('display', 'flex', 'important');
                hoverBtn.innerHTML = '📥';
                hoverBtn.style.setProperty('background', '#2563eb', 'important');
            }
        } else {
            // Delay nhỏ trước khi ẩn để cho phép chuột di chuyển vào Nút
            hideTimer = setTimeout(() => {
                if (!hoverBtn.matches(':hover')) {
                    hoverBtn.style.setProperty('display', 'none', 'important');
                }
            }, 200);
        }
    }, { passive: true });

    // 4. Xử lý sự kiện Click Nút 📥 Save API & Gửi Data đến Sheet
    hoverBtn.addEventListener('click', async function (e) {
        e.preventDefault();
        e.stopPropagation();

        if (!currentTargetImgUrl) return;

        // Cập nhật trạng thái giao diện Nút (Icon xoay / trạng thái)
        hoverBtn.innerHTML = '⏳';
        hoverBtn.style.setProperty('background', '#eab308', 'important');

        try {
            // Gửi Message cho Background Service Worker để Upload & Ghi Sheet LUU_ANH_API
            chrome.runtime.sendMessage({
                type: "SAVE_IMAGE_TO_SHEET_API",
                imageUrl: currentTargetImgUrl,
                pageUrl: window.location.href,
                title: document.title
            }, (response) => {
                if (response && response.ok) {
                    hoverBtn.innerHTML = '✅';
                    hoverBtn.style.setProperty('background', '#16a34a', 'important');
                } else {
                    hoverBtn.innerHTML = '❌';
                    hoverBtn.style.setProperty('background', '#dc2626', 'important');
                }
                setTimeout(() => {
                    hoverBtn.style.setProperty('display', 'none', 'important');
                }, 1500);
            });
        } catch (err) {
            console.error("Lỗi Save API Image:", err);
            hoverBtn.innerHTML = '❌';
            hoverBtn.style.setProperty('background', '#dc2626', 'important');
        }
    });
})();
