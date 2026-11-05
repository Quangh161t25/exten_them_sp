import React, { useEffect, useState } from 'react';

// Bấm vào ảnh trong bảng (hoặc ô sản phẩm) -> hiện ảnh to ngay trên trang, không mở tab mới.
// Bấm ra ngoài, nút × hoặc phím Esc để đóng.
const SELECTOR = 'table img, .dh-product img';

export default function ImageLightbox() {
    const [src, setSrc] = useState('');

    useEffect(() => {
        const onClick = (e) => {
            const img = e.target.closest?.(SELECTOR);
            if (!img || !img.src || img.closest('.img-lightbox')) return;
            // Chặn link bọc ảnh (target=_blank) và thao tác chọn dòng
            e.preventDefault();
            e.stopPropagation();
            setSrc(img.currentSrc || img.src);
        };
        const onKey = (e) => { if (e.key === 'Escape') setSrc(''); };
        document.addEventListener('click', onClick, true);
        document.addEventListener('keydown', onKey);
        return () => { document.removeEventListener('click', onClick, true); document.removeEventListener('keydown', onKey); };
    }, []);

    if (!src) return null;
    return (
        <div className="img-lightbox" role="dialog" aria-label="Xem ảnh" onClick={() => setSrc('')}
            style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(15,23,42,.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, cursor: 'zoom-out' }}>
            <img src={src} alt="" onClick={(e) => e.stopPropagation()}
                style={{ maxWidth: 'min(90vw, 900px)', maxHeight: '88vh', objectFit: 'contain', background: '#fff', borderRadius: 8, boxShadow: '0 10px 40px rgba(0,0,0,.4)', cursor: 'default' }} />
            <button type="button" aria-label="Đóng" onClick={() => setSrc('')}
                style={{ position: 'fixed', top: 16, right: 20, width: 36, height: 36, borderRadius: '50%', border: 0, background: '#fff', fontSize: 22, lineHeight: '36px', cursor: 'pointer' }}>×</button>
        </div>
    );
}
