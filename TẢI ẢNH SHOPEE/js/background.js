if (chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
        .catch(console.error);
}

if (chrome.downloads && chrome.downloads.onDeterminingFilename) {
    chrome.downloads.onDeterminingFilename.addListener((item, suggest) => {
        if (item.filename && (item.filename.endsWith('.jfif') || item.filename.includes('tải_xuống') || item.filename.includes('download'))) {
            let newName = item.filename.replace(/\.jfif$/i, '.jpg');
            newName = newName.replace(/tải_xuống|download/g, 'shopee_anh');
            suggest({ filename: newName });
            return true;
        }
        suggest();
    });
}
