
((()=>{
    var a=document.createElement('script');
    a.src=chrome.runtime.getURL('js/contentScript.js');
    a.onload=function(){this.remove();};
    (document.head||document.documentElement).appendChild(a);
})());

let currentProductData = null;

window.addEventListener('message', function(b) {
    if (b.source != window) return;
    const c = b.data;
    if (c.action && c.action === 'sendProductData') {
        currentProductData = c.data;
        try {
            chrome.runtime.sendMessage({'action': 'sendProductData', 'data': c.data});
        } catch(e) {}
    }
}, false);

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.action === 'requestProductData') {
        sendResponse({data: currentProductData});
    }
});

