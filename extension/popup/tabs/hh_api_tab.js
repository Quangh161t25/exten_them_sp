(() => {
  const tab=document.getElementById('tab-hh-api'),frame=document.getElementById('hh-api-frame');
  function load(){if(!tab.hidden&&!frame.src)frame.src=chrome.runtime.getURL('extension/hh-api/app.html');}
  new MutationObserver(load).observe(tab,{attributes:true,attributeFilter:['hidden','class','style']});
  document.getElementById('hh-api-open').onclick=()=>window.openSellerHub('hh-api');load();
})();
// Mở extension: nếu đã quá giờ tự cập nhật Hàng hoàn API mà hôm nay chưa chạy thì chạy bù
chrome.runtime.sendMessage({ type: 'HH_API_AUTO_CHECK' }).catch(() => {});
