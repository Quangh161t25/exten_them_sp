// Nút "✨ AI thêm hashtag" cho ô Tiêu đề / mô tả (trang Soạn & đăng).
// Dùng khoá Gemini đã lưu trong extension (geminiApiKey / geminiApiKeys – cùng chỗ với Chat AI / Sao chép SP).
(() => {
  const ta = document.getElementById('caption');
  const field = document.getElementById('fCaption');
  if (!ta || !field) return;

  const bar = document.createElement('div');
  bar.style.cssText = 'display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:6px';
  bar.innerHTML = `<button type="button" class="btn" id="aiTagBtn" title="AI đọc tiêu đề + sản phẩm gắn kèm rồi thêm hashtag phù hợp">✨ AI thêm hashtag</button>
    <label class="small muted" style="display:inline-flex;align-items:center;gap:4px"><input type="checkbox" id="aiTagRewrite"> Viết lại tiêu đề hấp dẫn hơn</label>
    <span class="small muted" id="aiTagMsg"></span>`;
  field.appendChild(bar);
  const btn = bar.querySelector('#aiTagBtn');
  const msg = bar.querySelector('#aiTagMsg');

  const MODELS = ['gemini-2.0-flash', 'gemini-2.5-flash-lite', 'gemini-2.0-flash-lite', 'gemini-2.5-flash', 'gemini-1.5-flash'];

  async function getKeys() {
    const r = await chrome.storage.local.get(['geminiApiKey', 'geminiApiKeys', 'geminiModel']);
    const keys = (Array.isArray(r.geminiApiKeys) && r.geminiApiKeys.length ? r.geminiApiKeys : [r.geminiApiKey])
      .map((k) => String(k || '').trim()).filter(Boolean);
    return { keys, model: r.geminiModel };
  }

  async function askGemini(prompt) {
    const { keys, model } = await getKeys();
    if (!keys.length) throw new Error('Chưa có khoá Gemini. Vào tab Chat AI / Ảnh AI & API của extension để nhập khoá Gemini.');
    let lastErr = '';
    for (const key of keys) {
      for (const m of [...new Set([model, ...MODELS].filter(Boolean))]) {
        try {
          const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(m)}:generateContent?key=${encodeURIComponent(key)}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.7, maxOutputTokens: 2048, ...(/2\.5-flash/.test(m) ? { thinkingConfig: { thinkingBudget: 0 } } : {}) } })
          });
          const data = await res.json();
          if (!res.ok) { lastErr = data.error?.message || `HTTP ${res.status}`; continue; }
          const cand = data.candidates?.[0] || {};
          const text = (cand.content?.parts || []).map((p) => p.text || '').join('').trim();
          if (cand.finishReason === 'MAX_TOKENS') { lastErr = 'AI trả lời bị cắt'; continue; }
          if (text) return text;
        } catch (e) { lastErr = e.message; }
      }
    }
    throw new Error(lastErr || 'AI không trả lời');
  }

  // Tên sản phẩm đang gắn vào video (chip + dòng đã chọn)
  const productNames = () => [...new Set([...document.querySelectorAll('#chips *')]
    .filter((e) => !e.children.length).map((e) => e.textContent.replace(/[×✕]/g, '').trim()).filter((t) => t.length > 5))].slice(0, 6);

  btn.onclick = async () => {
    const caption = ta.value.trim();
    const products = productNames();
    if (!caption && !products.length) { msg.textContent = 'Nhập tiêu đề hoặc gắn sản phẩm trước.'; return; }
    const rewrite = bar.querySelector('#aiTagRewrite').checked;
    btn.disabled = true;
    msg.style.color = '';
    msg.textContent = 'AI đang viết…';
    try {
      const prompt = `Bạn là chuyên gia bán hàng Shopee Video tại Việt Nam.
Tiêu đề hiện tại: "${caption || '(chưa có)'}"
Sản phẩm gắn trong video: ${products.length ? products.join(' | ') : '(không có)'}
${rewrite
  ? 'Viết lại 1 tiêu đề/mô tả ngắn (tối đa 150 ký tự) hấp dẫn, đúng sản phẩm, rồi thêm 6-10 hashtag tiếng Việt không dấu và tiếng Anh phổ biến trên Shopee Video (luôn có #ShopeeVideo).'
  : 'Giữ nguyên tiêu đề, chỉ đưa ra 6-10 hashtag phù hợp nhất (tiếng Việt không dấu và tiếng Anh phổ biến trên Shopee Video, luôn có #ShopeeVideo).'}
Chỉ trả về đúng nội dung cần dán, không giải thích, hashtag cách nhau bởi dấu cách.`;
      let out = (await askGemini(prompt)).replace(/^["'`]+|["'`]+$/g, '').trim();
      if (rewrite) {
        ta.value = out.slice(0, 2200);
      } else {
        const tags = [...new Set((out.match(/#[\p{L}\p{N}_]+/gu) || []))]
          .filter((t) => !caption.toLowerCase().includes(t.toLowerCase()));
        if (!tags.length) throw new Error('AI không trả về hashtag hợp lệ, thử lại.');
        ta.value = `${caption} ${tags.join(' ')}`.trim().slice(0, 2200);
      }
      ta.dispatchEvent(new Event('input', { bubbles: true }));
      msg.textContent = '✔ Đã thêm. Kiểm tra lại trước khi đăng.';
      msg.style.color = '#15803d';
    } catch (e) {
      msg.textContent = 'Lỗi: ' + e.message;
      msg.style.color = '#dc2626';
    } finally {
      btn.disabled = false;
    }
  };
})();
