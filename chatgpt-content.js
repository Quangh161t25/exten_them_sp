// chatgpt-content.js - Chạy trên chatgpt.com
// Lắng nghe message từ popup để tự điền text + paste ảnh vào textarea ChatGPT

function findChatGptTextarea() {
  return document.querySelector('#prompt-textarea') || 
         document.querySelector('.ProseMirror') ||
         document.querySelector('[contenteditable="true"]') ||
         document.querySelector('textarea');
}

function typeIntoChatGpt(editor, text) {
  if (!editor || !text) return;
  editor.focus();
  
  try {
    if (editor.getAttribute('contenteditable') === 'true' || editor.classList.contains('ProseMirror')) {
      editor.innerHTML = '<p><br></p>';
      document.execCommand('selectAll', false, null);
      document.execCommand('insertText', false, text);
    } else {
      editor.value = text;
    }
  } catch(e) {
    editor.textContent = text;
  }
  
  editor.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true, inputType: 'insertText', data: text }));
  editor.dispatchEvent(new Event('change', { bubbles: true }));
}

async function pasteImageToChatGpt(editor, base64Data, mimeType) {
  try {
    let cleanBase64 = base64Data;
    if (cleanBase64.includes(',')) {
      cleanBase64 = cleanBase64.split(',')[1];
    }
    const byteString = atob(cleanBase64);
    const arr = new Uint8Array(byteString.length);
    for (let i = 0; i < byteString.length; i++) {
      arr[i] = byteString.charCodeAt(i);
    }
    mimeType = mimeType || 'image/png';
    const ext = mimeType.split('/')[1] || 'png';
    const blob = new Blob([arr], { type: mimeType });
    const file = new File([blob], `image.${ext}`, { type: mimeType, lastModified: Date.now() });
    
    const dt = new DataTransfer();
    dt.items.add(file);
    
    let pasteEvent;
    try {
      pasteEvent = new ClipboardEvent('paste', {
        bubbles: true,
        cancelable: true,
        clipboardData: dt
      });
    } catch(e) {
      pasteEvent = new Event('paste', { bubbles: true, cancelable: true });
    }
    
    try {
      Object.defineProperty(pasteEvent, 'clipboardData', {
        value: dt,
        writable: false,
        configurable: true
      });
    } catch(e) {}
    
    editor.focus();
    editor.dispatchEvent(pasteEvent);
    return true;
  } catch(e) {
    console.error('ChatGPT paste image error:', e);
    return false;
  }
}

// Biến cờ ngăn chặn xử lý 2 lần
let isProcessingChatGpt = false;

function handleChatGptFill(message, sendResponse) {
  if (isProcessingChatGpt) {
    if (sendResponse) sendResponse({ ok: true, ignored: true });
    return;
  }
  isProcessingChatGpt = true;

  const tryFill = (attempts) => {
    const editor = findChatGptTextarea();
    if (!editor) {
      if (attempts > 0) {
        setTimeout(() => tryFill(attempts - 1), 600);
      } else {
        isProcessingChatGpt = false;
        if (sendResponse) sendResponse({ ok: false, message: 'Không tìm thấy khung nhập ChatGPT' });
      }
      return;
    }

    // 1. Điền text trước
    if (message.text) {
      typeIntoChatGpt(editor, message.text);
    }

    // 2. Dán ảnh (nếu có)
    const images = message.images || [];
    if (images.length > 0) {
      setTimeout(async () => {
        const imgData = images[0];
        await pasteImageToChatGpt(editor, imgData.base64, imgData.mimeType || 'image/png');
        
        // Nhả cờ sau khi hoàn tất
        setTimeout(() => {
          isProcessingChatGpt = false;
          if (sendResponse) sendResponse({ ok: true });
        }, 1000);
      }, 300);
    } else {
      isProcessingChatGpt = false;
      if (sendResponse) sendResponse({ ok: true });
    }
  };
  
  tryFill(20);
}

// Lắng nghe message từ popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'CHATGPT_FILL') {
    handleChatGptFill(message, sendResponse);
    return true;
  }
});

console.log('[Shopee Extension] ChatGPT content script ready');
