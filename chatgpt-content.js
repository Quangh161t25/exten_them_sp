// chatgpt-content.js - Chạy trên chatgpt.com
// Lắng nghe message từ popup để tự điền text + paste ảnh vào textarea ChatGPT

function findChatGptTextarea() {
  return document.querySelector('#prompt-textarea') || 
         document.querySelector('.ProseMirror') ||
         document.querySelector('[contenteditable="true"]');
}

function typeIntoChatGpt(editor, text) {
  editor.focus();
  
  // Clear existing content (ChatGPT ProseMirror has its own structure)
  editor.innerHTML = '<p><br></p>';
  
  // Use execCommand for compatibility
  document.execCommand('selectAll', false, null);
  document.execCommand('insertText', false, text);
  
  // Also dispatch input events
  editor.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true, inputType: 'insertText', data: text }));
  editor.dispatchEvent(new Event('change', { bubbles: true }));
}

async function pasteImageToChatGpt(editor, base64Data, mimeType) {
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
    console.error('ChatGPT paste image error:', e);
    return false;
  }
}

// Lắng nghe message từ popup/background
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'CHATGPT_FILL') {
    const tryFill = (attempts) => {
      const editor = findChatGptTextarea();
      if (!editor) {
        if (attempts > 0) {
          setTimeout(() => tryFill(attempts - 1), 800);
        } else {
          sendResponse({ ok: false, message: 'Khong tim thay textarea ChatGPT' });
        }
        return;
      }

      // Điền text vào
      if (message.text) {
        typeIntoChatGpt(editor, message.text);
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
        pasteImageToChatGpt(editor, imgData.base64, imgData.mimeType || 'image/png').then(() => setTimeout(pasteNext, 500));
      };
      pasteNext();
    };
    
    tryFill(15); // thử 15 lần x 0.8s = 12 giây max
    return true; // async response
  }
});

console.log('[Shopee Extension] ChatGPT content script loaded');
