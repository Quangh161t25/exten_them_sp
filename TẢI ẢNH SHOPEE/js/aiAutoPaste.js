
(async function() {
    console.log('AI Auto Paste script loaded');
    const storage = await chrome.storage.local.get(['pendingAiPrompt']);
    if (!storage.pendingAiPrompt) return;
    
    const { image, text, ai } = storage.pendingAiPrompt;
    
    // Clear it so it doesn't run again on reload
    await chrome.storage.local.remove('pendingAiPrompt');
    
    async function getBlobFromUrl(url) {
        const response = await fetch(url);
        return await response.blob();
    }
    
    async function doPaste(element) {
        element.focus();
        
        // Sometimes dispatching paste is enough for images
        const dataTransfer = new DataTransfer();
        
        if (text) {
            dataTransfer.setData('text/plain', text);
            // Try inserting text natively to ensure it shows up in rich text editors
            try {
                document.execCommand('insertText', false, text);
            } catch(e) {}
        }
        
        if (image) {
            try {
                const blob = await getBlobFromUrl(image);
                const file = new File([blob], 'product_image.png', { type: blob.type || 'image/png' });
                dataTransfer.items.add(file);
            } catch(e) {
                console.error('Fetch image error', e);
            }
        }
        
        const pasteEvent = new ClipboardEvent('paste', {
            clipboardData: dataTransfer,
            bubbles: true,
            cancelable: true
        });
        element.dispatchEvent(pasteEvent);
        
        // Also simulate drop event as a fallback
        const dropEvent = new DragEvent('drop', {
            dataTransfer: dataTransfer,
            bubbles: true,
            cancelable: true
        });
        element.dispatchEvent(dropEvent);
    }
    
    function findInputAndPaste() {
        return new Promise((resolve) => {
            const interval = setInterval(async () => {
                let inputElement = null;
                
                if (window.location.hostname.includes('chatgpt.com')) {
                    inputElement = document.querySelector('#prompt-textarea');
                } else if (window.location.hostname.includes('gemini.google.com')) {
                    // Try to find Gemini's input box more precisely
                    inputElement = document.querySelector('rich-textarea div[contenteditable=\'true\']') 
                                || document.querySelector('div[role=\'textbox\'][contenteditable=\'true\']:not([aria-hidden=\'true\'])')
                                || document.querySelector('.text-input-field');
                }
                
                if (inputElement && inputElement.offsetParent !== null) {
                    clearInterval(interval);
                    // Wait a tiny bit for the page to fully initialize its event listeners
                    setTimeout(async () => {
                        await doPaste(inputElement);
                        resolve();
                    }, 500);
                }
            }, 500);
            
            setTimeout(() => {
                clearInterval(interval);
                resolve();
            }, 10000);
        });
    }
    
    if (document.readyState === 'complete') {
        findInputAndPaste();
    } else {
        window.addEventListener('load', findInputAndPaste);
    }
})();

