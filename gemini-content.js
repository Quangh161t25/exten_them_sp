// gemini-content.js - Chạy trên gemini.google.com
// Lắng nghe message từ popup để tự điền text + paste ảnh vào textarea Gemini

function findGeminiTextarea() {
  return document.querySelector('.ql-editor[contenteditable="true"][aria-label]') ||
         document.querySelector('.ql-editor[contenteditable="true"]') ||
         document.querySelector('div.rich-textarea') ||
         document.querySelector('[data-placeholder][contenteditable="true"]') ||
         document.querySelector('div[contenteditable="true"]') ||
         document.querySelector('textarea');
}

function findGeminiSendButton() {
  return document.querySelector('button[aria-label="Send message"]') ||
         document.querySelector('button[data-mat-icon-name="send"]') ||
         document.querySelector('button.send-button') ||
         document.querySelector('button[jsname="Qoeydf"]') ||
         document.querySelector('button[aria-label*="gửi"]') ||
         document.querySelector('button[aria-label*="Send"]') ||
         document.querySelector('.send-button-container button') ||
         document.querySelector('mat-icon[fonticon="send"]')?.closest('button');
}

function typeIntoGemini(editor, text) {
  if (!editor || !text) return;
  editor.focus();
  try {
    editor.innerHTML = '<p><br></p>';
    document.execCommand('selectAll', false, null);
    document.execCommand('insertText', false, text);
  } catch(e) {
    editor.textContent = text;
  }
  editor.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true, inputType: 'insertText', data: text }));
  editor.dispatchEvent(new Event('change', { bubbles: true }));
}

// Paste NHIỀU ảnh cùng lúc trong 1 DataTransfer → Gemini nhận đủ tất cả ảnh
async function pasteImagesToGemini(editor, imagesData) {
  try {
    const dt = new DataTransfer();

    for (let i = 0; i < imagesData.length; i++) {
      const imgData = imagesData[i];
      let cleanBase64 = imgData.base64;
      if (cleanBase64.includes(',')) cleanBase64 = cleanBase64.split(',')[1];
      const byteString = atob(cleanBase64);
      const arr = new Uint8Array(byteString.length);
      for (let j = 0; j < byteString.length; j++) arr[j] = byteString.charCodeAt(j);
      const mimeType = imgData.mimeType || 'image/png';
      const ext = mimeType.split('/')[1] || 'png';
      const blob = new Blob([arr], { type: mimeType });
      const file = new File([blob], `image_${i + 1}.${ext}`, { type: mimeType, lastModified: Date.now() });
      dt.items.add(file);
    }

    let pasteEvent;
    try {
      pasteEvent = new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: dt });
    } catch(e) {
      pasteEvent = new Event('paste', { bubbles: true, cancelable: true });
    }
    try {
      Object.defineProperty(pasteEvent, 'clipboardData', { value: dt, writable: false, configurable: true });
    } catch(e) {}

    editor.focus();
    editor.dispatchEvent(pasteEvent);
    return true;
  } catch(e) {
    console.error('Gemini paste images error:', e);
    return false;
  }
}

function clickGeminiSend() {
  const btn = findGeminiSendButton();
  if (btn && !btn.disabled) {
    btn.click();
    return true;
  }
  const editor = findGeminiTextarea();
  if (editor) {
    editor.focus();
    editor.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, bubbles: true, composed: true }));
    editor.dispatchEvent(new KeyboardEvent('keypress', { key: 'Enter', keyCode: 13, bubbles: true, composed: true }));
    editor.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', keyCode: 13, bubbles: true, composed: true }));
    return true;
  }
  return false;
}

// Biến cờ ngăn chặn xử lý 2 lần
let isProcessingGemini = false;

function handleGeminiFill(message, sendResponse) {
  if (isProcessingGemini) {
    if (sendResponse) sendResponse({ ok: true, ignored: true });
    return;
  }
  isProcessingGemini = true;

  const tryFill = (attempts) => {
    const editor = findGeminiTextarea();
    if (!editor) {
      if (attempts > 0) {
        setTimeout(() => tryFill(attempts - 1), 600);
      } else {
        isProcessingGemini = false;
        if (sendResponse) sendResponse({ ok: false, message: 'Không tìm thấy khung nhập Gemini' });
      }
      return;
    }

    // 1. Điền text trước
    if (message.text) {
      typeIntoGemini(editor, message.text);
    }

    // 2. Dán TẤT CẢ ảnh cùng lúc trong 1 DataTransfer (paste 1 lần duy nhất)
    const images = message.images || [];
    const autoSend = message.autoSend !== false;

    if (images.length > 0) {
      setTimeout(async () => {
        await pasteImagesToGemini(editor, images);
        setTimeout(() => {
          isProcessingGemini = false;
          if (sendResponse) sendResponse({ ok: true });
          if (autoSend) {
            setTimeout(() => clickGeminiSend(), 800);
          }
        }, 1000);
      }, 300);
    } else {
      isProcessingGemini = false;
      if (sendResponse) sendResponse({ ok: true });
      if (autoSend) {
        setTimeout(() => clickGeminiSend(), 400);
      }
    }
  };

  tryFill(20);
}

// Lắng nghe message từ popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GEMINI_FILL') {
    handleGeminiFill(message, sendResponse);
    return true;
  }
});

console.log('[Shopee Extension] Gemini content script ready');
