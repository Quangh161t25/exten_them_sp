(function() {
  "use strict";

  function dataUrlToFile(dataUrl, filename) {
    try {
      const arr = dataUrl.split(",");
      const mimeMatch = arr[0].match(/:(.*?);/);
      const mime = mimeMatch ? mimeMatch[1] : "image/jpeg";
      const bstr = atob(arr[1]);
      let n = bstr.length;
      const u8arr = new Uint8Array(n);
      while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
      }
      return new File([u8arr], filename, { type: mime });
    } catch (e) {
      console.error("[Shopee Clone AI] dataUrlToFile error:", e);
      return null;
    }
  }

  // Báo tiến độ về Side Panel (hiện trong nhật ký)
  function reportStatus(msg, color) {
    try {
      chrome.storage.local.set({ aiStatus: { text: String(msg).replace(/^Shopee Clone: /, ""), error: color === "#ed4014", ts: Date.now() } });
    } catch (e) {}
  }

  function showSuccessBadge(msg, color) {
    reportStatus(msg, color);
    try {
      const existing = document.getElementById("scl-ai-badge");
      if (existing) existing.remove();

      const badge = document.createElement("div");
      badge.id = "scl-ai-badge";
      badge.style.position = "fixed";
      badge.style.top = "18px";
      badge.style.left = "50%";
      badge.style.transform = "translateX(-50%)";
      badge.style.backgroundColor = color || "#19be6b";
      badge.style.color = "#ffffff";
      badge.style.padding = "10px 22px";
      badge.style.borderRadius = "24px";
      badge.style.boxShadow = "0 6px 16px rgba(0,0,0,0.25)";
      badge.style.zIndex = "2147483647";
      badge.style.fontSize = "14px";
      badge.style.fontWeight = "600";
      badge.style.fontFamily = "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
      badge.style.pointerEvents = "none";
      badge.innerText = msg;
      document.body.appendChild(badge);

      setTimeout(() => {
        badge.style.transition = "opacity 0.6s ease";
        badge.style.opacity = "0";
        setTimeout(() => badge.remove(), 700);
      }, 5000);
    } catch (e) {}
  }

  function waitForElement(selectorFn, timeout = 25000) {
    return new Promise((resolve) => {
      const el = selectorFn();
      if (el) return resolve(el);

      const observer = new MutationObserver(() => {
        const found = selectorFn();
        if (found) {
          observer.disconnect();
          resolve(found);
        }
      });

      if (document.body) {
        observer.observe(document.body, { childList: true, subtree: true });
      } else {
        document.addEventListener("DOMContentLoaded", () => {
          observer.observe(document.body, { childList: true, subtree: true });
        });
      }

      setTimeout(() => {
        observer.disconnect();
        resolve(selectorFn());
      }, timeout);
    });
  }

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // Count attached-image previews currently shown by Gemini's composer
  function countGeminiAttachments() {
    const root =
      document.querySelector("input-area-v2") ||
      document.querySelector(".input-area-container") ||
      document.querySelector("rich-textarea")?.closest("form, fieldset, div[class*='input-area']") ||
      document;
    return root.querySelectorAll('img[src^="blob:"], uploader-file-preview, [data-test-id*="file-preview"]').length;
  }

  function pasteFiles(target, files) {
    if (!target || !files || !files.length) return false;
    const dt = new DataTransfer();
    files.forEach((f) => dt.items.add(f));
    target.focus();
    let evt;
    try {
      evt = new ClipboardEvent("paste", { bubbles: true, cancelable: true, clipboardData: dt });
    } catch (_) {
      evt = new Event("paste", { bubbles: true, cancelable: true });
    }
    try {
      Object.defineProperty(evt, "clipboardData", { value: dt, writable: false, configurable: true });
    } catch (_) {}
    target.dispatchEvent(evt);
    return evt.defaultPrevented;
  }

  function dropFiles(target, files) {
    if (!target || !files || !files.length) return;
    const dt = new DataTransfer();
    files.forEach((f) => dt.items.add(f));
    ["dragenter", "dragover", "drop"].forEach((evType) => {
      const ev = new DragEvent(evType, { bubbles: true, cancelable: true, dataTransfer: dt });
      try {
        Object.defineProperty(ev, "dataTransfer", { value: dt, writable: false, configurable: true });
      } catch (_) {}
      target.dispatchEvent(ev);
    });
  }

  function insertText(editor, text) {
    editor.focus();
    document.execCommand("selectAll", false, null);
    document.execCommand("insertText", false, text);
    if (!editor.textContent.includes(text.slice(0, 20))) {
      editor.innerText = text;
      editor.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: text }));
    }
  }

  // --- GEMINI HANDLER ---
  async function handleGemini(payload) {
    console.log("[Shopee Clone AI] Handling Gemini upload...", payload);

    const getGeminiEditor = () =>
      document.querySelector('rich-textarea .ql-editor[contenteditable="true"]') ||
      document.querySelector('rich-textarea [contenteditable="true"]') ||
      document.querySelector('div[role="textbox"][contenteditable="true"]');

    let editor = await waitForElement(getGeminiEditor, 30000);
    if (!editor) {
      console.warn("[Shopee Clone AI] Gemini editor not found within timeout.");
      showSuccessBadge("Shopee Clone: Không tìm thấy ô nhập của Gemini (bạn đã đăng nhập chưa?)");
      return;
    }

    showSuccessBadge("Shopee Clone: Đã nhận lệnh, đang dán ảnh và prompt vào Gemini...");

    // Gemini renders the editor before its paste/upload handlers are attached.
    // Acting too early makes the paste get ignored and the text get wiped.
    await sleep(2500);
    editor = getGeminiEditor() || editor;

    const files = [];
    for (const img of payload.images || []) {
      if (img && img.dataUrl) {
        const f = dataUrlToFile(img.dataUrl, img.name || "image.jpg");
        if (f) files.push(f);
      }
    }
    console.log("[Shopee Clone AI] Files prepared:", files.length);

    // 1. Attach images (one by one keeps their order: ảnh 1, ảnh 2)
    let attached = 0;
    for (const file of files) {
      let ok = false;
      for (let attempt = 0; attempt < 5 && !ok; attempt++) {
        editor = getGeminiEditor() || editor;
        const before = countGeminiAttachments();
        const handled = pasteFiles(editor, [file]);
        if (!handled && attempt >= 2) dropFiles(editor, [file]);
        for (let i = 0; i < 10; i++) {
          await sleep(300);
          if (countGeminiAttachments() > before) { ok = true; break; }
        }
        // Paste was accepted but preview selector didn't match — don't paste again
        if (!ok && handled) ok = true;
        if (!ok) await sleep(1000);
      }
      if (ok) attached++;
      else console.warn("[Shopee Clone AI] Could not attach", file.name);
      await sleep(500);
    }

    // 2. Insert prompt text (re-check, Gemini may re-render the editor)
    let textOk = !payload.prompt;
    if (payload.prompt) {
      for (let attempt = 0; attempt < 5 && !textOk; attempt++) {
        editor = getGeminiEditor() || editor;
        try {
          insertText(editor, payload.prompt);
        } catch (e) {
          console.error("[Shopee Clone AI] Error inserting text:", e);
        }
        await sleep(800);
        const cur = getGeminiEditor();
        textOk = !!cur && cur.textContent.includes(payload.prompt.slice(0, 20));
      }
    }

    if (attached === files.length && textOk) {
      showSuccessBadge(`Shopee Clone: Đã thêm ${attached} ảnh + prompt vào Gemini!`);
    } else {
      showSuccessBadge(
        `Shopee Clone: Đã thêm ${attached}/${files.length} ảnh${textOk ? " + prompt" : ", chưa điền được prompt (đã copy sẵn, nhấn Ctrl+V)"}`
      );
    }

    if (payload.autoSend) {
      if (!textOk || attached !== files.length) {
        showSuccessBadge("Shopee Clone: Chưa đủ ảnh/prompt nên không tự gửi. Hãy kiểm tra rồi tự bấm gửi.", "#ed4014");
        return;
      }
      await geminiAutoSendAndCollect();
    }
  }

  const GEMINI_GEN_IMG_SELECTOR = "generated-image img.image, single-image.generated-image img";

  const getGeminiSendButton = () => {
    const btns = [
      ...document.querySelectorAll(".send-button button"),
      ...document.querySelectorAll('button[aria-label="Gửi tin nhắn"], button[aria-label="Send message"]'),
    ];
    return btns.find((b) => !b.disabled && b.getAttribute("aria-disabled") !== "true" && b.offsetParent !== null) || null;
  };

  // Ask the background to download a Gemini image and store it as the new cover
  function sendCoverToExtension(url, source = "ai") {
    return new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage({ type: "sclFetchImage", url, source }, (res) => {
          if (chrome.runtime.lastError || !res || !res.ok) {
            resolve({ ok: false, error: (chrome.runtime.lastError && chrome.runtime.lastError.message) || (res && res.error) || "tiện ích không phản hồi – hãy Reload tiện ích rồi F5 trang Gemini" });
          } else {
            resolve(res);
          }
        });
      } catch (e) {
        resolve({ ok: false, error: "Tiện ích vừa được tải lại, hãy F5 trang Gemini" });
      }
    });
  }

  const readBlobAsDataUrl = (blob) => new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result);
    fr.onerror = () => reject(fr.error);
    fr.readAsDataURL(blob);
  });

  // Vẽ ảnh đang hiển thị ra canvas (chỉ được khi ảnh cùng nguồn, ví dụ blob:)
  function imageToDataUrlViaCanvas(img) {
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    canvas.getContext("2d").drawImage(img, 0, 0);
    return canvas.toDataURL("image/png");
  }

  async function saveCoverDataUrl(dataUrl, source = "gemini") {
    const { aiLastProductId } = await chrome.storage.local.get("aiLastProductId");
    await chrome.storage.local.set({
      aiCoverImage: { dataUrl, timestamp: Date.now(), source: source, productId: aiLastProductId || "" },
    });
  }
  async function sendCoverFromImage(img, source = "gemini") {
    const src = img.currentSrc || img.src || "";

    // 1. Nếu là blob: hoặc data:, xử lý trực tiếp qua canvas hoặc blob
    if (/^(blob|data):/.test(src)) {
      try {
        let dataUrl;
        try {
          dataUrl = imageToDataUrlViaCanvas(img);
        } catch (_) {
          dataUrl = await readBlobAsDataUrl(await (await fetch(src)).blob());
        }
        if (dataUrl && dataUrl.length > 500) {
          await saveCoverDataUrl(dataUrl, source);
          return { ok: true };
        }
      } catch (e) {
        console.warn("[Shopee Clone AI] blob/data error:", e);
      }
    }

    // 2. Thử vẽ canvas nếu ảnh đã hiển thị trên trang (không bị CORS taint)
    try {
      if (img.complete && img.naturalWidth > 0) {
        const dataUrl = imageToDataUrlViaCanvas(img);
        if (dataUrl && dataUrl.length > 500) {
          await saveCoverDataUrl(dataUrl, source);
          return { ok: true };
        }
      }
    } catch (_) {}

    // 3. Thử tải trực tiếp trong trang web (context của trang)
    if (src && /^https?:/.test(src)) {
      try {
        const resp = await fetch(src);
        if (resp.ok) {
          const blob = await resp.blob();
          const dataUrl = await readBlobAsDataUrl(blob);
          if (dataUrl && dataUrl.length > 500) {
            await saveCoverDataUrl(dataUrl, source);
            return { ok: true };
          }
        }
      } catch (_) {}
    }

    // 4. Nhờ background service worker tải ảnh về
    if (src) {
      const res = await sendCoverToExtension(src, source);
      if (res.ok) return res;
    }

    return { ok: false, error: "Không đọc được dữ liệu ảnh từ trang" };
  }

  async function geminiAutoSendAndCollect() {
    const before = document.querySelectorAll(GEMINI_GEN_IMG_SELECTOR).length;

    // Wait until the send button is usable (images may still be uploading)
    let btn = null;
    for (let i = 0; i < 120 && !btn; i++) {
      btn = getGeminiSendButton();
      if (!btn) await sleep(500);
    }
    if (!btn) {
      showSuccessBadge("Shopee Clone: Không bấm được nút gửi của Gemini, hãy tự bấm gửi.", "#ed4014");
      return;
    }
    await sleep(1500);
    (getGeminiSendButton() || btn).click();
    showSuccessBadge("Shopee Clone: Đã gửi, đang chờ Gemini tạo ảnh...");

    // Wait for a new generated image (up to 5 minutes)
    let img = null;
    for (let i = 0; i < 600 && !img; i++) {
      await sleep(500);
      const list = document.querySelectorAll(GEMINI_GEN_IMG_SELECTOR);
      if (list.length > before) {
        const last = list[list.length - 1];
        if (last.complete && last.naturalWidth > 0 && /^(https?|blob|data):/.test(last.currentSrc || last.src)) img = last;
      }
    }
    if (!img) {
      showSuccessBadge("Shopee Clone: Hết thời gian chờ mà Gemini chưa tạo ảnh. Hãy thử lại hoặc bấm nút 📥 trên ảnh.", "#ed4014");
      return;
    }
    await sleep(2000);
    const list = document.querySelectorAll(GEMINI_GEN_IMG_SELECTOR);
    img = list[list.length - 1] || img;

    showSuccessBadge("Shopee Clone: Gemini đã tạo ảnh, đang lấy ảnh về tiện ích...");
    const res = await sendCoverFromImage(img);
    if (!res.ok) {
      showSuccessBadge("Shopee Clone: Không lấy được ảnh (" + res.error + "). Hãy tải ảnh về rồi bấm 'Chọn ảnh từ máy'.", "#ed4014");
      return;
    }
    const box = img.closest("single-image") || img.closest("generated-image");
    const b = box && box.querySelector(".scl-cover-btn");
    if (b) b.textContent = "✔ Đã dùng làm ảnh bìa";
    showSuccessBadge("Shopee Clone: Đã lấy ảnh bìa! Tiện ích đang tự động sao chép sang Shopee...");
  }

  // --- CHATGPT HELPERS & HANDLER ---
  const getChatGptInput = () => {
    return (
      document.querySelector("#prompt-textarea") ||
      document.querySelector('div[contenteditable="true"].ProseMirror') ||
      document.querySelector('div[contenteditable="true"][id*="prompt"]') ||
      document.querySelector('div[role="textbox"][contenteditable="true"]') ||
      document.querySelector('div[contenteditable="true"]') ||
      document.querySelector("textarea#prompt-textarea") ||
      document.querySelector('textarea[data-id="root"]') ||
      document.querySelector("textarea")
    );
  };

  function countChatGptAttachments() {
    const root = document.querySelector("form") || document.querySelector("fieldset") || document;
    return root.querySelectorAll(
      'img[src^="blob:"], [data-testid*="attachment"], [data-testid*="file"], div[class*="attachment"], div[class*="thumbnail"], button[aria-label*="Xóa"], button[aria-label*="Remove"], button[aria-label*="Delete"]'
    ).length;
  }

  async function insertTextIntoChatGpt(editor, text) {
    if (!editor || !text) return false;
    editor.focus();
    await sleep(200);

    if (editor.getAttribute("contenteditable") === "true" || editor.classList.contains("ProseMirror")) {
      const sel = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(editor);
      sel.removeAllRanges();
      sel.addRange(range);

      let ok = false;
      try {
        ok = document.execCommand("selectAll", false, null);
        ok = document.execCommand("insertText", false, text);
      } catch (_) {}

      if (!ok || !editor.textContent.includes(text.slice(0, 15))) {
        try {
          editor.dispatchEvent(new InputEvent("beforeinput", {
            bubbles: true,
            cancelable: true,
            inputType: "insertText",
            data: text
          }));
          let p = editor.querySelector("p");
          if (!p) {
            p = document.createElement("p");
            editor.appendChild(p);
          }
          p.textContent = text;
          editor.dispatchEvent(new InputEvent("input", {
            bubbles: true,
            inputType: "insertText",
            data: text
          }));
        } catch (_) {}
      }

      if (!editor.textContent.includes(text.slice(0, 15))) {
        try {
          const dt = new DataTransfer();
          dt.setData("text/plain", text);
          const pe = new ClipboardEvent("paste", { bubbles: true, cancelable: true, clipboardData: dt });
          try { Object.defineProperty(pe, "clipboardData", { value: dt }); } catch (_) {}
          editor.dispatchEvent(pe);
        } catch (_) {}
      }
    } else {
      editor.value = text;
    }

    editor.dispatchEvent(new Event("input", { bubbles: true }));
    editor.dispatchEvent(new Event("change", { bubbles: true }));
    await sleep(300);
    return editor.textContent.includes(text.slice(0, 15)) || (editor.value && editor.value.includes(text.slice(0, 15)));
  }

  const getChatGptSendButton = () => {
    const form = document.querySelector("form") || document;
    const btns = [
      ...form.querySelectorAll('button[data-testid="send-button"]'),
      ...form.querySelectorAll('button[aria-label*="Send"]'),
      ...form.querySelectorAll('button[aria-label*="Gửi"]'),
      ...form.querySelectorAll('button[class*="send-button"]'),
      ...form.querySelectorAll('button[type="submit"]')
    ];
    return btns.find((b) => {
      if (b.disabled || b.getAttribute("aria-disabled") === "true") return false;
      if (b.offsetParent === null) return false;
      const label = (b.getAttribute("aria-label") || "").toLowerCase();
      if (label.includes("voice") || label.includes("speech") || label.includes("mic") || label.includes("thoại")) return false;
      return true;
    }) || null;
  };

  async function handleChatGpt(payload) {
    console.log("[Shopee Clone AI] Handling ChatGPT upload...", payload);
    showSuccessBadge("Shopee Clone: Đã nhận lệnh, đang chuẩn bị thêm ảnh và prompt vào ChatGPT...", "#10a37f");
    reportStatus("Đang tải trang ChatGPT và chuẩn bị dán dữ liệu...");

    // Ghi nhớ các ảnh đang có sẵn trước khi gửi câu hỏi mới
    const existingSrcs = new Set();
    document.querySelectorAll('article img, [data-message-author-role="assistant"] img, main img, img[src*="oaiusercontent"]').forEach((im) => {
      const s = im.currentSrc || im.src;
      if (s) existingSrcs.add(s);
    });

    let textarea = await waitForElement(getChatGptInput, 30000);
    if (!textarea) {
      console.warn("[Shopee Clone AI] ChatGPT textarea not found within timeout.");
      showSuccessBadge("Shopee Clone: Không tìm thấy ô nhập của ChatGPT (bạn đã đăng nhập chưa?)", "#ed4014");
      reportStatus("Không tìm thấy ô nhập ChatGPT (hãy đăng nhập ChatGPT)", "#ed4014");
      return;
    }

    // Chờ React của ChatGPT hydrate và gắn xong các bộ lắng nghe sự kiện
    await sleep(2500);
    textarea = getChatGptInput() || textarea;

    const files = [];
    if (payload.images && payload.images.length) {
      for (const img of payload.images) {
        if (img && img.dataUrl) {
          const f = dataUrlToFile(img.dataUrl, img.name || "image.jpg");
          if (f) files.push(f);
        }
      }
    }

    // 1. Tải ảnh lên ChatGPT
    if (files.length > 0) {
      console.log("[Shopee Clone AI] Attaching", files.length, "images to ChatGPT...");
      reportStatus(`Đang thêm ${files.length} ảnh vào ChatGPT...`);
      let attached = false;

      for (let attempt = 0; attempt < 5 && !attached; attempt++) {
        textarea = getChatGptInput() || textarea;
        const beforeCount = countChatGptAttachments();

        // Thử gán vào input[type="file"] nếu có
        let fileInput = document.querySelector('input[type="file"]');
        if (!fileInput) {
          const attachBtn = document.querySelector('button[data-testid="attach-button"], button[aria-label*="Attach"], button[aria-label*="Đính kèm"], button[aria-label*="tệp"]');
          if (attachBtn) {
            try { attachBtn.click(); } catch (_) {}
            await sleep(300);
            fileInput = document.querySelector('input[type="file"]');
          }
        }

        if (fileInput) {
          try {
            const dt = new DataTransfer();
            files.forEach((f) => dt.items.add(f));
            const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "files");
            if (descriptor && descriptor.set) {
              descriptor.set.call(fileInput, dt.files);
            } else {
              fileInput.files = dt.files;
            }
            fileInput.dispatchEvent(new Event("input", { bubbles: true }));
            fileInput.dispatchEvent(new Event("change", { bubbles: true }));
          } catch (_) {}
        }

        // Đồng thời dispatch sự kiện paste & drop
        pasteFiles(textarea, files);
        dropFiles(textarea, files);
        const form = textarea.closest("form") || document.querySelector("form");
        if (form) dropFiles(form, files);

        for (let i = 0; i < 10; i++) {
          await sleep(350);
          if (countChatGptAttachments() > beforeCount) {
            attached = true;
            break;
          }
        }
        if (!attached) await sleep(1000);
      }

      // Chờ các spinner tiến trình tải ảnh của ChatGPT kết thúc
      for (let s = 0; s < 30; s++) {
        const composer = document.querySelector("form") || document;
        const spinners = composer.querySelectorAll('[class*="spinner"], svg[class*="animate-spin"], [aria-label*="Loading"], [aria-label*="Đang tải"]');
        if (spinners.length === 0) break;
        await sleep(500);
      }
      await sleep(1000);
    }

    // 2. Điền prompt
    let textOk = !payload.prompt;
    if (payload.prompt) {
      console.log("[Shopee Clone AI] Inserting prompt into ChatGPT...");
      reportStatus("Đang điền prompt vào ChatGPT...");
      for (let attempt = 0; attempt < 5 && !textOk; attempt++) {
        textarea = getChatGptInput() || textarea;
        textOk = await insertTextIntoChatGpt(textarea, payload.prompt);
        if (!textOk) await sleep(800);
      }
    }

    if (textOk) {
      showSuccessBadge(`Shopee Clone: Đã thêm ${files.length} ảnh + prompt vào ChatGPT!`, "#10a37f");
      reportStatus(`Đã thêm ${files.length} ảnh + prompt vào ChatGPT`);
    } else {
      showSuccessBadge("Shopee Clone: Đã thêm ảnh vào ChatGPT (nhấn Ctrl+V để dán prompt).", "#10a37f");
      reportStatus("Đã thêm ảnh vào ChatGPT, hãy nhấn Ctrl+V để dán prompt.");
    }

    if (payload.autoSend || payload.auto) {
      await chatGptAutoSendAndCollect(existingSrcs);
    }
  }

  async function chatGptAutoSendAndCollect(existingSrcs) {
    reportStatus("Đang chờ ChatGPT sẵn sàng gửi tin nhắn...");

    // 1. Chờ nút gửi của ChatGPT kích hoạt (khi ảnh tải xong)
    let btn = null;
    for (let i = 0; i < 60 && !btn; i++) {
      btn = getChatGptSendButton();
      if (!btn) await sleep(500);
    }
    if (!btn) {
      showSuccessBadge("Shopee Clone: Không bấm được nút gửi ChatGPT, hãy bấm gửi thủ công.", "#ed4014");
      reportStatus("Không bấm được nút gửi ChatGPT, hãy bấm gửi thủ công.", "#ed4014");
      return;
    }

    await sleep(1000);
    const finalBtn = getChatGptSendButton() || btn;
    finalBtn.click();
    showSuccessBadge("Shopee Clone: Đã gửi, đang chờ ChatGPT tạo ảnh...", "#10a37f");
    reportStatus("Đã gửi, đang chờ ChatGPT tạo ảnh...");

    // Nếu sau 1.5 giây nút gửi vẫn còn chưa gửi, thử mô phỏng Enter
    await sleep(1500);
    const checkBtn = getChatGptSendButton();
    if (checkBtn) {
      const editor = getChatGptInput();
      if (editor) {
        editor.dispatchEvent(new KeyboardEvent("keydown", {
          key: "Enter",
          code: "Enter",
          keyCode: 13,
          which: 13,
          bubbles: true
        }));
      }
    }

    // 2. Chờ ChatGPT tạo ảnh mới (lên tới 5 phút)
    let foundImg = null;
    for (let i = 0; i < 600 && !foundImg; i++) {
      await sleep(500);
      const candidates = Array.from(document.querySelectorAll(
        'article img, [data-message-author-role="assistant"] img, main img, img[src*="oaiusercontent"], img[alt*="Generated"]'
      ));
      for (let j = candidates.length - 1; j >= 0; j--) {
        const im = candidates[j];
        const src = im.currentSrc || im.src || "";
        if (!src) continue;
        if (im.closest('[class*="avatar"], button[id*="headlessui"]') || (im.naturalWidth > 0 && im.naturalWidth < 120)) continue;
        if (existingSrcs && existingSrcs.has(src)) continue;
        if (im.complete && (im.naturalWidth >= 120 || im.naturalWidth === 0)) {
          foundImg = im;
          break;
        }
      }
    }

    if (!foundImg) {
      showSuccessBadge("Shopee Clone: Hết thời gian chờ tạo ảnh. Bấm nút 📥 Bìa trên ảnh khi tạo xong.", "#ed4014");
      reportStatus("Hết thời gian chờ tạo ảnh. Bấm nút 📥 trên ảnh khi xong.", "#ed4014");
      return;
    }
    await sleep(2000);

    showSuccessBadge("Shopee Clone: ChatGPT đã tạo ảnh, đang lấy ảnh về tiện ích...", "#10a37f");
    reportStatus("Đã phát hiện ảnh ChatGPT, đang lưu làm ảnh bìa...");

    const res = await sendCoverFromImage(foundImg, "chatgpt");
    if (!res.ok) {
      showSuccessBadge("Shopee Clone: Không lấy được ảnh (" + res.error + "). Hãy bấm nút 📥 trên ảnh hoặc kéo ảnh vào tiện ích.", "#ed4014");
      reportStatus("Lỗi lấy ảnh: " + res.error, "#ed4014");
      return;
    }

    const box = foundImg.closest('div.relative, div[class*="relative"], div.overflow-hidden, div[class*="group"]') || foundImg.parentElement;
    const b = box && box.querySelector(".scl-cover-btn");
    if (b) b.textContent = "✔ Đã dùng làm ảnh bìa";

    showSuccessBadge("Shopee Clone: Đã lấy ảnh bìa từ ChatGPT! Tiện ích đang tự động sao chép sang Shopee...", "#10a37f");
    reportStatus("Đã lấy ảnh bìa từ ChatGPT thành công!");
  }

  // --- CHATGPT: "use generated image as cover" button ---
  function setupChatGptCoverButtons() {
    const addButtons = () => {
      const candidateImages = document.querySelectorAll(
        'article img, [data-message-author-role="assistant"] img, div[class*="image"] img, img[src*="oaiusercontent"], img[alt*="Generated"], main img'
      );

      candidateImages.forEach((img) => {
        if (img.closest('[class*="avatar"], button[id*="headlessui-menu-button"]')) return;
        if (img.naturalWidth > 0 && img.naturalWidth < 120 && img.naturalHeight > 0 && img.naturalHeight < 120) return;
        // Bỏ qua ảnh thu nhỏ (ảnh người dùng gửi, dải ảnh nhỏ bên cạnh) — chỉ gắn nút lên ảnh lớn
        const shown = img.getBoundingClientRect();
        if (shown.width > 0 && shown.width < 200) return;
        if (img.closest('[data-message-author-role="user"]')) return;

        const box = img.closest('div.relative, div[class*="relative"], div.overflow-hidden, div[class*="group"]') || img.parentElement;
        if (!box || box.querySelector(".scl-cover-btn")) return;
        if (getComputedStyle(box).position === "static") box.style.position = "relative";

        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "scl-cover-btn";
        btn.textContent = "📥 Bìa"; btn.title = "Dùng làm ảnh bìa";
        Object.assign(btn.style, {
          position: "absolute",
          top: "6px",
          left: "6px",
          zIndex: "9999",
          padding: "2px 8px",
          border: "none",
          borderRadius: "10px",
          background: "#10a37f",
          color: "#fff",
          fontSize: "11px",
          lineHeight: "16px",
          fontWeight: "600",
          whiteSpace: "nowrap",
          width: "auto",
          maxWidth: "none",
          cursor: "pointer",
          opacity: "0.92",
          boxShadow: "0 1px 4px rgba(0,0,0,0.25)"
        });
        btn.addEventListener("click", (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          const im = img;
          btn.disabled = true;
          btn.textContent = "Đang lấy ảnh...";
          sendCoverFromImage(im, "chatgpt").then((res) => {
            btn.disabled = false;
            if (!res.ok) {
              console.warn("[Shopee Clone AI] Fetch cover failed:", res.error);
              btn.textContent = "📥 Bìa"; btn.title = "Dùng làm ảnh bìa";
              showSuccessBadge("Shopee Clone: Không lấy được ảnh (" + res.error + "). Hãy kéo ảnh hoặc bấm Ctrl+V trong tiện ích.", "#ed4014");
              return;
            }
            btn.textContent = "✔ Đã dùng làm ảnh bìa";
            showSuccessBadge("Shopee Clone: Đã lấy ảnh làm ảnh bìa! Quay lại tiện ích và bấm 'Sao chép sang Shopee'.");
          });
        });
        box.appendChild(btn);
      });
    };

    let timer = null;
    const start = () => {
      addButtons();
      new MutationObserver(() => {
        clearTimeout(timer);
        timer = setTimeout(addButtons, 400);
      }).observe(document.body, { childList: true, subtree: true });
    };
    if (document.body) start();
    else document.addEventListener("DOMContentLoaded", start);
  }

  // --- GEMINI: "use generated image as cover" button ---
  function setupGeminiCoverButtons() {
    const addButtons = () => {
      document.querySelectorAll("generated-image img.image, single-image.generated-image img").forEach((img) => {
        const box = img.closest("single-image") || img.closest("generated-image") || img.parentElement;
        if (!box || box.querySelector(".scl-cover-btn")) return;
        if (getComputedStyle(box).position === "static") box.style.position = "relative";

        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "scl-cover-btn";
        btn.textContent = "📥 Bìa"; btn.title = "Dùng làm ảnh bìa";
        Object.assign(btn.style, {
          position: "absolute",
          top: "6px",
          left: "6px",
          zIndex: "5",
          padding: "2px 8px",
          border: "none",
          borderRadius: "10px",
          background: "#ee4d2d",
          color: "#fff",
          fontSize: "11px",
          lineHeight: "16px",
          fontWeight: "600",
          whiteSpace: "nowrap",
          width: "auto",
          maxWidth: "none",
          cursor: "pointer",
          opacity: "0.92",
          boxShadow: "0 1px 4px rgba(0,0,0,0.25)"
        });
        btn.addEventListener("click", (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          const im = box.querySelector("img.image") || img;
          btn.disabled = true;
          btn.textContent = "Đang lấy ảnh...";
          sendCoverFromImage(im).then((res) => {
            btn.disabled = false;
            if (!res.ok) {
              console.warn("[Shopee Clone AI] Fetch cover failed:", res.error);
              btn.textContent = "📥 Bìa"; btn.title = "Dùng làm ảnh bìa";
              showSuccessBadge("Shopee Clone: Không lấy được ảnh (" + res.error + "). Hãy tải ảnh về rồi bấm 'Chọn ảnh từ máy' trong tiện ích.", "#ed4014");
              return;
            }
            btn.textContent = "✔ Đã dùng làm ảnh bìa";
            showSuccessBadge("Shopee Clone: Đã lấy ảnh làm ảnh bìa! Quay lại tiện ích và bấm 'Sao chép sang Shopee'.");
          });
        });
        box.appendChild(btn);
      });
    };

    let timer = null;
    const start = () => {
      addButtons();
      new MutationObserver(() => {
        clearTimeout(timer);
        timer = setTimeout(addButtons, 400);
      }).observe(document.body, { childList: true, subtree: true });
    };
    if (document.body) start();
    else document.addEventListener("DOMContentLoaded", start);
  }

  const currentHost = window.location.hostname.toLowerCase();
  if (currentHost.includes("gemini.google.com")) {
    setupGeminiCoverButtons();
  } else if (currentHost.includes("chatgpt.com") || currentHost.includes("openai.com")) {
    setupChatGptCoverButtons();
  }

  // --- CHECK AND DISPATCH ---
  let myTabIdPromise = null;
  const getMyTabId = () => {
    if (!myTabIdPromise) {
      myTabIdPromise = new Promise((resolve) => {
        let attempts = 0;
        const ask = () => {
          try {
            chrome.runtime.sendMessage({ type: "sclWhoAmI" }, (res) => {
              if (chrome.runtime.lastError || !res) {
                if (++attempts < 3) {
                  setTimeout(ask, 300);
                } else {
                  resolve(null);
                }
              } else {
                resolve(res.tabId);
              }
            });
          } catch (e) {
            resolve(null);
          }
        };
        ask();
      });
    }
    return myTabIdPromise;
  };

  function checkAndProcessPayload() {
    if (typeof chrome === "undefined" || !chrome.storage || !chrome.storage.local) return;

    chrome.storage.local.get("pendingAiPayload", async (res) => {
      const payload = res ? res.pendingAiPayload : null;
      if (!payload || !payload.timestamp) return;

      // Lệnh chỉ dành cho đúng tab mà Side Panel vừa mở
      if (payload.tabId) {
        const myTabId = await getMyTabId();
        if (myTabId && myTabId !== payload.tabId) return;
      }

      // Only process payloads created in the last 2 minutes
      if (Date.now() - payload.timestamp > 120000) {
        chrome.storage.local.remove("pendingAiPayload");
        return;
      }

      const host = window.location.hostname.toLowerCase();
      const isGemini = host.includes("gemini.google.com");
      const isChatGpt = host.includes("chatgpt.com") || host.includes("openai.com");

      if (window.__sclAiHandled === payload.timestamp) return;
      if ((payload.target === "gemini" && isGemini) || (payload.target === "chatgpt" && isChatGpt)) {
        window.__sclAiHandled = payload.timestamp;
      }

      if (payload.target === "gemini" && isGemini) {
        chrome.storage.local.remove("pendingAiPayload");
        handleGemini(payload);
      } else if (payload.target === "chatgpt" && isChatGpt) {
        chrome.storage.local.remove("pendingAiPayload");
        handleChatGpt(payload);
      }
    });
  }

  // Run on initial load
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", checkAndProcessPayload);
  } else {
    checkAndProcessPayload();
  }

  // Also listen for storage changes in case the tab is already opened
  try {
    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.onChanged) {
      chrome.storage.onChanged.addListener((changes, area) => {
        if (area === "local" && changes.pendingAiPayload && changes.pendingAiPayload.newValue) {
          checkAndProcessPayload();
        }
      });
    }
  } catch (e) {}

})();
