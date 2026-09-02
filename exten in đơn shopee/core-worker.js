chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({
    openPanelOnActionClick: true
  });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== "DOWNLOAD_AWB_PDF") {
    return false;
  }

  let didRespond = false;
  const timeoutId = setTimeout(() => {
    if (didRespond) {
      return;
    }

    didRespond = true;
    sendResponse({
      ok: false,
      message: "Qua thoi gian cho tai PDF."
    });
  }, 10000);

  chrome.downloads.download({
    url: message.url,
    filename: message.filename || "shopee-awb.pdf",
    saveAs: false
  }, (downloadId) => {
    if (didRespond) {
      return;
    }

    didRespond = true;
    clearTimeout(timeoutId);

    if (chrome.runtime.lastError) {
      sendResponse({
        ok: false,
        message: chrome.runtime.lastError.message
      });
      return;
    }

    sendResponse({
      ok: true,
      downloadId
    });
  });

  return true;
});
