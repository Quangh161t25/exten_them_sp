// gemini-content.js - Chạy trên gemini.google.com
// Lắng nghe message từ popup để tự điền text + paste ảnh vào textarea Gemini

function findGeminiTextarea() {
  return document.querySelector('.ql-editor[contenteditable="true"][aria-label]') ||
         document.querySelector('.ql-editor[contenteditable="true"]') ||
         document.querySelector('[data-placeholder][contenteditable="true"]');
}

function typeIntoGemini(editor, text) {
  editor.focus();
  // Clear existing content
  editor.innerHTML = '<p><br></p>';
  
  // Use execCommand for compatibility with Angular/Quill
  document.execCommand('selectAll', false, null);
  document.execCommand('insertText', false, text);
  
  // Also dispatch input events
  editor.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true, inputType: 'insertText', data: text }));
  editor.dispatchEvent(new Event('change', { bubbles: true }));
}

async function pasteImageToGemini(editor, base64Data, mimeType) {
  try {
    const byteString = atob(base64Data);
    const arr = new Uint8Array(byteString.length);
    for (let i = 0; i < byteString.length; i++) {
      arr[i] = byteString.charCodeAt(i);
    }
    const blob = new Blob([arr], { type: mimeType });
    const file = new File([blob], 'template.png', { type: mimeType });
    
    const dt = new DataTransfer();
    dt.items.add(file);
    
    const pasteEvent = new ClipboardEvent('paste', {
      bubbles: true,
      cancelable: true,
      clipboardData: dt
    });
    
    editor.focus();
    editor.dispatchEvent(pasteEvent);
    return true;
  } catch(e) {
    console.error('Gemini paste image error:', e);
    return false;
  }
}

// Lắng nghe message từ popup/background
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GEMINI_FILL') {
    const tryFill = (attempts) => {
      const editor = findGeminiTextarea();
      if (!editor) {
        if (attempts > 0) {
          setTimeout(() => tryFill(attempts - 1), 800);
        } else {
          sendResponse({ ok: false, message: 'Khong tim thay textarea Gemini' });
        }
        return;
      }

      // Điền text vào
      if (message.text) {
        typeIntoGemini(editor, message.text);
      }

      // Paste ảnh lần lượt (nếu có)
      const images = message.images || [];
      let imgIndex = 0;
      const pasteNext = () => {
        if (imgIndex >= images.length) {
          sendResponse({ ok: true });
          return;
        }
        const imgData = images[imgIndex++];
        pasteImageToGemini(editor, imgData.base64, imgData.mimeType || 'image/png').then(pasteNext);
      };
      pasteNext();
    };
    
    tryFill(15); // thử 15 lần x 0.8s = 12 giây max
    return true; // async response
  }
});

console.log('[Shopee Extension] Gemini content script loaded');
